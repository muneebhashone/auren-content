import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { needsWindowsShell } from "./cli-spawn";
import type {
  CallOptions,
  CallResult,
  ChatMessage,
  CodexReasoningEffort,
} from "./types";

function getBin(): string {
  return process.env.CODEX_BIN || "codex";
}

const LOG = process.env.LLM_LOG !== "0";

function flattenMessages(messages: ChatMessage[]): string {
  const parts: string[] = [];
  for (const m of messages) {
    const label = m.role === "system" ? "SYSTEM" : m.role.toUpperCase();
    if (typeof m.content === "string") {
      parts.push(`${label}:\n${m.content}`);
    } else {
      const text = m.content
        .map((c) => (c.type === "text" ? c.text : `[image: ${c.image_url.url}]`))
        .join("\n");
      parts.push(`${label}:\n${text}`);
    }
  }
  return parts.join("\n\n");
}

export async function callCodex(
  opts: CallOptions,
  model: string,
  reasoningEffort?: CodexReasoningEffort
): Promise<CallResult<string>> {
  let prompt = flattenMessages(opts.messages);
  if (opts.json) {
    prompt +=
      "\n\nRespond with ONLY a single valid JSON object. No prose, no code fences, no explanation.";
  }

  const bin = getBin();
  const tempDir = await mkdtemp(join(tmpdir(), "auren-codex-"));
  const outputFile = join(tempDir, "last-message.txt");
  const args = [
    ...(opts.task === "research" ? ["--search"] : []),
    "exec",
    "--ephemeral",
    "--sandbox",
    "read-only",
    "-c",
    'approval_policy="never"',
    "--model",
    model,
    ...(reasoningEffort
      ? ["-c", `model_reasoning_effort="${reasoningEffort}"`]
      : []),
    "--output-last-message",
    outputFile,
    "-",
  ];

  if (LOG) {
    console.log(
      `[llm] -> codex task=${opts.task} model=${model} json=${!!opts.json} promptChars=${prompt.length}`
    );
    console.log(`[llm]   prompt: ${truncate(prompt, 800)}`);
  }
  const startedAt = Date.now();

  try {
    const { stderr } = await runWithStdin(bin, args, prompt);
    const text = (await readFile(outputFile, "utf8")).trim();
    const ms = Date.now() - startedAt;

    if (LOG) {
      console.log(
        `[llm] <- codex task=${opts.task} model=${model} ${ms}ms outChars=${text.length}`
      );
      console.log(`[llm]   output: ${truncate(text, 800)}`);
    }

    if (!text) {
      throw new Error(
        `Codex CLI returned no final message. stderr: ${stderr.trim().slice(0, 300) || "(empty)"}`
      );
    }

    return {
      content: text,
      raw: text,
      model,
      provider: "codex",
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

function runWithStdin(
  bin: string,
  args: string[],
  stdin: string
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(bin, args, {
      stdio: ["pipe", "pipe", "pipe"],
      shell: needsWindowsShell(bin),
    });

    child.on("error", (err) => {
      reject(
        new Error(
          `Codex CLI spawn failed (bin: ${bin}): ${err.message}. Ensure 'codex' is on PATH or set CODEX_BIN.`
        )
      );
    });
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `Codex CLI exited with code ${code}. stderr: ${stderr.trim() || "(empty)"}`
          )
        );
        return;
      }
      resolve({ stdout, stderr });
    });
    child.stdin.end(stdin);
  });
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n) + `... [+${s.length - n} chars]`;
}
