import { spawn } from "node:child_process";
import { needsWindowsShell } from "./cli-spawn";
import type { CallOptions, CallResult, ChatMessage, ClaudeEffort } from "./types";

function getBin(): string {
  return process.env.CLAUDE_CODE_BIN || "claude";
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

interface ClaudeJsonResult {
  type?: string;
  subtype?: string;
  is_error?: boolean;
  result?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

export async function callClaudeCode(
  opts: CallOptions,
  model: string,
  effort?: ClaudeEffort
): Promise<CallResult<string>> {
  let prompt = flattenMessages(opts.messages);
  if (opts.json) {
    prompt +=
      "\n\nRespond with ONLY a single valid JSON object. No prose, no code fences, no explanation.";
  }

  const bin = getBin();
  const args = [
    "--print",
    "--output-format",
    "json",
    "--no-session-persistence",
    "--disable-slash-commands",
    "--tools",
    "",
    "--model",
    model,
    ...(effort ? ["--effort", effort] : []),
  ];

  if (LOG) {
    console.log(
      `[llm] -> claude task=${opts.task} model=${model} effort=${effort ?? "default"} json=${!!opts.json} promptChars=${prompt.length}`
    );
    console.log(`[llm]   prompt: ${truncate(prompt, 800)}`);
  }
  const startedAt = Date.now();

  const { stdout, stderr } = await runWithStdin(bin, args, prompt, effort);
  const parsed = parseClaudeJson(stdout);
  const text = (parsed.result ?? "").trim();
  const ms = Date.now() - startedAt;

  if (LOG) {
    console.log(
      `[llm] <- claude task=${opts.task} model=${model} ${ms}ms outChars=${text.length}`
    );
    console.log(`[llm]   output: ${truncate(text, 800)}`);
  }

  if (parsed.is_error || parsed.type !== "result") {
    throw new Error(
      `Claude Code CLI returned an error result. stderr: ${stderr.trim().slice(0, 300) || "(empty)"}`
    );
  }
  if (!text) {
    throw new Error(
      `Claude Code CLI returned no text content. stderr: ${stderr.trim().slice(0, 300) || "(empty)"}`
    );
  }

  return {
    content: text,
    raw: text,
    model,
    provider: "claude",
    usage: parsed.usage
      ? {
          prompt_tokens: parsed.usage.input_tokens,
          completion_tokens: parsed.usage.output_tokens,
          total_tokens:
            (parsed.usage.input_tokens ?? 0) + (parsed.usage.output_tokens ?? 0),
        }
      : undefined,
  };
}

function runWithStdin(
  bin: string,
  args: string[],
  stdin: string,
  effort: ClaudeEffort | undefined
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const env = {
      ...process.env,
      ...(effort ? { CLAUDE_CODE_EFFORT_LEVEL: effort } : {}),
    };
    const child = spawn(bin, args, {
      stdio: ["pipe", "pipe", "pipe"],
      shell: needsWindowsShell(bin),
      env,
    });

    child.on("error", (err) => {
      reject(
        new Error(
          `Claude Code CLI spawn failed (bin: ${bin}): ${err.message}. Ensure 'claude' is on PATH or set CLAUDE_CODE_BIN.`
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
            `Claude Code CLI exited with code ${code}. stderr: ${stderr.trim() || "(empty)"}`
          )
        );
        return;
      }
      resolve({ stdout, stderr });
    });
    child.stdin.end(stdin);
  });
}

function parseClaudeJson(stdout: string): ClaudeJsonResult {
  try {
    return JSON.parse(stdout) as ClaudeJsonResult;
  } catch (err) {
    throw new Error(
      `Claude Code CLI returned non-JSON output: ${(err as Error).message}. Output: ${stdout.trim().slice(0, 300)}`
    );
  }
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n) + `... [+${s.length - n} chars]`;
}
