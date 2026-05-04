import { spawn } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join, resolve } from "node:path";
import { needsWindowsShell } from "@/lib/llm/cli-spawn";

const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function getBin(): string {
  return process.env.CODEX_BIN || "codex";
}

export async function generatePostImageWithCodex({
  postId,
  imagePrompt,
}: {
  postId: number;
  imagePrompt: string;
}): Promise<string> {
  const trimmed = imagePrompt.trim();
  if (!trimmed) throw new Error("This post has no image prompt.");

  const outDir = await mkdtemp(join(tmpdir(), "auren-codex-image-"));
  const outputFile = join(outDir, "last-message.txt");
  const prompt = [
    "Use the image generation feature to create exactly one social-media-ready image from this prompt.",
    "Save the image file in the current working directory.",
    `Use a filename beginning with post-${postId}.`,
    "Return only the generated image filename or absolute path. No prose.",
    "",
    "Image prompt:",
    trimmed,
  ].join("\n");

  try {
    await runCodexImage(outDir, outputFile, prompt);
    const returned = (await readFile(outputFile, "utf8").catch(() => "")).trim();
    const generated = await findGeneratedImage(outDir, returned);
    const ext = extname(generated).toLowerCase();
    const publicDir = join(
      /* turbopackIgnore: true */ process.cwd(),
      "public",
      "generated"
    );
    await mkdir(publicDir, { recursive: true });
    const publicName = `post-${postId}-${Date.now()}${ext}`;
    const publicPath = join(publicDir, publicName);
    await copyFile(generated, publicPath);
    return `/generated/${publicName}`;
  } finally {
    await rm(outDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function runCodexImage(
  cwd: string,
  outputFile: string,
  prompt: string
): Promise<void> {
  const bin = getBin();
  const model = process.env.CODEX_IMAGE_MODEL || process.env.CODEX_MODEL || "gpt-5.5";
  const reasoningEffort = process.env.CODEX_IMAGE_REASONING_EFFORT;
  const args = [
    "exec",
    "--ephemeral",
    "--skip-git-repo-check",
    "--sandbox",
    "workspace-write",
    "-c",
    'approval_policy="never"',
    "--model",
    model,
    ...(isReasoningEffort(reasoningEffort)
      ? ["-c", `model_reasoning_effort="${reasoningEffort}"`]
      : []),
    "--output-last-message",
    outputFile,
    "-",
  ];

  await new Promise<void>((resolvePromise, reject) => {
    let stderr = "";
    const child = spawn(bin, args, {
      cwd,
      stdio: ["pipe", "ignore", "pipe"],
      shell: needsWindowsShell(bin),
    });
    child.on("error", (err) => {
      reject(
        new Error(
          `Codex CLI spawn failed (bin: ${bin}): ${err.message}. Ensure 'codex' is on PATH or set CODEX_BIN.`
        )
      );
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Codex image generation exited with code ${code}. stderr: ${stderr.trim() || "(empty)"}`
          )
        );
        return;
      }
      resolvePromise();
    });
    child.stdin.end(prompt);
  });
}

function isReasoningEffort(value: string | undefined): boolean {
  return value === "low" || value === "medium" || value === "high" || value === "xhigh";
}

async function findGeneratedImage(outDir: string, returned: string): Promise<string> {
  const candidates: string[] = [];
  const safeRoot = resolve(outDir);
  const cleaned = returned.replace(/^["'`]+|["'`]+$/g, "").trim();
  if (cleaned) {
    const maybe = resolve(outDir, cleaned);
    if (maybe.startsWith(safeRoot)) candidates.push(maybe);
    candidates.push(resolve(outDir, basename(cleaned)));
  }

  for (const entry of await readdir(outDir)) {
    candidates.push(resolve(outDir, entry));
  }

  for (const candidate of Array.from(new Set(candidates))) {
    if (!candidate.startsWith(safeRoot)) continue;
    const ext = extname(candidate).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) continue;
    const info = await stat(candidate).catch(() => null);
    if (info?.isFile() && info.size > 0) return candidate;
  }

  throw new Error("Codex CLI did not produce a PNG, JPG, JPEG, or WEBP image file.");
}
