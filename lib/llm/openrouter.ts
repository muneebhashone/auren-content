import type { CallOptions, CallResult } from "./types";
import { DEFAULT_TEMP_BY_TASK } from "./types";

export type { ChatMessage } from "./types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const LOG = process.env.LLM_LOG !== "0";

function flattenForLog(messages: CallOptions["messages"]): string {
  return messages
    .map((m) => {
      const c =
        typeof m.content === "string"
          ? m.content
          : m.content
              .map((p) => (p.type === "text" ? p.text : `[image]`))
              .join("\n");
      return `${m.role.toUpperCase()}:\n${c}`;
    })
    .join("\n\n");
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + `… [+${s.length - n} chars]`;
}

export async function callOpenRouter(
  opts: CallOptions,
  model: string
): Promise<CallResult<string>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey)
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local before generating."
    );

  const temperature =
    opts.temperature ?? DEFAULT_TEMP_BY_TASK[opts.task] ?? 0.6;

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature,
    max_tokens: opts.maxTokens ?? 2400,
  };
  if (opts.json) body.response_format = { type: "json_object" };
  if (opts.providerHints) body.provider = opts.providerHints;
  if (opts.extraBody) Object.assign(body, opts.extraBody);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (process.env.OPENROUTER_SITE_URL)
    headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
  if (process.env.OPENROUTER_APP_NAME)
    headers["X-Title"] = process.env.OPENROUTER_APP_NAME;

  if (LOG) {
    const promptStr = flattenForLog(opts.messages);
    console.log(
      `[llm] → openrouter task=${opts.task} model=${model} json=${!!opts.json} temp=${temperature} promptChars=${promptStr.length}`
    );
    console.log(`[llm]   prompt: ${truncate(promptStr, 800)}`);
  }
  const startedAt = Date.now();

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${text}`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    model?: string;
    usage?: CallResult["usage"];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  if (LOG) {
    const ms = Date.now() - startedAt;
    const u = data.usage;
    const usageStr = u
      ? `tokens=${u.prompt_tokens ?? "?"}/${u.completion_tokens ?? "?"}`
      : "tokens=?";
    console.log(
      `[llm] ← openrouter task=${opts.task} model=${data.model ?? model} ${ms}ms ${usageStr} outChars=${content.length}`
    );
    console.log(`[llm]   output: ${truncate(content, 800)}`);
  }
  return {
    content,
    raw: content,
    model: data.model ?? model,
    provider: "openrouter",
    usage: data.usage,
  };
}
