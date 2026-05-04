import { spawn } from "node:child_process";
import type { CallOptions, CallResult, ChatMessage } from "./types";

function getBin(): string {
  return process.env.OPENCODE_BIN || "opencode";
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

interface OpenCodeEvent {
  type?: string;
  part?: {
    type?: string;
    text?: string;
    tool?: string;
    state?: { status?: string; output?: string };
  };
  message?: { role?: string };
}

function extractAssistantText(events: OpenCodeEvent[]): string {
  // opencode --format json emits NDJSON events. The assistant's natural-language
  // output lives in events whose part.type === "text" (and part.text is the
  // running text). Tool calls live in part.type === "tool" — skip them.
  let acc = "";
  for (const ev of events) {
    const part = ev.part;
    if (!part) continue;
    if (part.type === "text" && typeof part.text === "string") {
      acc += part.text;
    }
  }
  return acc;
}

function summarizeEvents(events: OpenCodeEvent[]): string {
  const counts: Record<string, number> = {};
  const tools: string[] = [];
  for (const ev of events) {
    const t = ev.part?.type ?? ev.type ?? "?";
    counts[t] = (counts[t] || 0) + 1;
    if (ev.part?.type === "tool" && ev.part.tool) tools.push(ev.part.tool);
  }
  const parts = Object.entries(counts).map(([k, v]) => `${k}=${v}`);
  if (tools.length) parts.push(`tools=[${Array.from(new Set(tools)).join(",")}]`);
  return parts.join(" ");
}

export async function callOpenCode(
  opts: CallOptions,
  model: string
): Promise<CallResult<string>> {
  let prompt = flattenMessages(opts.messages);
  if (opts.json) {
    prompt +=
      "\n\nRespond with ONLY a single valid JSON object. No prose, no code fences, no explanation.";
  }

  const bin = getBin();
  const args = [
    "run",
    "--model",
    model,
    "--format",
    "json",
    "--dangerously-skip-permissions",
    prompt,
  ];

  if (LOG) {
    console.log(
      `[llm] → opencode task=${opts.task} model=${model} json=${!!opts.json} promptChars=${prompt.length}`
    );
    console.log(`[llm]   prompt: ${truncate(prompt, 800)}`);
  }
  const startedAt = Date.now();

  return new Promise<CallResult<string>>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] });

    child.on("error", (err) => {
      reject(
        new Error(
          `OpenCode CLI spawn failed (bin: ${bin}): ${err.message}. Ensure 'opencode' is on PATH or set OPENCODE_BIN.`
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
            `OpenCode CLI exited with code ${code}. stderr: ${stderr.trim() || "(empty)"}`
          )
        );
        return;
      }

      const events: OpenCodeEvent[] = [];
      for (const line of stdout.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          events.push(JSON.parse(trimmed) as OpenCodeEvent);
        } catch {
          // ignore non-JSON noise
        }
      }

      const text = extractAssistantText(events);
      const ms = Date.now() - startedAt;

      if (LOG) {
        console.log(
          `[llm] ← opencode task=${opts.task} model=${model} ${ms}ms events=${events.length} ${summarizeEvents(events)} outChars=${text.length}`
        );
        console.log(`[llm]   output: ${truncate(text, 800)}`);
      }

      if (!text) {
        reject(
          new Error(
            `OpenCode CLI returned no text content. ${events.length} events parsed: ${summarizeEvents(events)}. stderr: ${stderr.trim().slice(0, 300) || "(empty)"}`
          )
        );
        return;
      }

      resolve({
        content: text,
        raw: text,
        model,
        provider: "opencode",
      });
    });
  });
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n) + `… [+${s.length - n} chars]`;
}
