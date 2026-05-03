import type { LlmTask } from "./router";
import { getModelForTask } from "./router";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type ChatMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | {
      role: "user";
      content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
    };

export interface CallOptions {
  task: LlmTask;
  messages: ChatMessage[];
  /** When true, instructs the model to return JSON. */
  json?: boolean;
  /** Temperature; default 0.7 for write tasks, 0.3 for analytic ones. */
  temperature?: number;
  /** Max output tokens. */
  maxTokens?: number;
  /** Override the routed model (rare). */
  modelOverride?: string;
  /** Extra OpenRouter routing flags. */
  providerHints?: Record<string, unknown>;
}

export interface CallResult<T = string> {
  content: T;
  raw: string;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

const DEFAULT_TEMP_BY_TASK: Partial<Record<LlmTask, number>> = {
  research: 0.2,
  strategy: 0.5,
  write: 0.8,
  hook: 0.9,
  polish: 0.4,
  rationale: 0.3,
  "feedback-analysis": 0.3,
};

export async function callLLM(opts: CallOptions): Promise<CallResult<string>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey)
    throw new Error(
      "OPENROUTER_API_KEY is not set. Add it to .env.local before generating."
    );

  const model = opts.modelOverride ?? (await getModelForTask(opts.task));
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

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (process.env.OPENROUTER_SITE_URL)
    headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
  if (process.env.OPENROUTER_APP_NAME)
    headers["X-Title"] = process.env.OPENROUTER_APP_NAME;

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
  return {
    content,
    raw: content,
    model: data.model ?? model,
    usage: data.usage,
  };
}

export async function callLLMJson<T>(opts: CallOptions): Promise<CallResult<T>> {
  const result = await callLLM({ ...opts, json: true });
  // Strip ```json fences if present
  const cleaned = result.raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  let parsed: T;
  try {
    parsed = JSON.parse(cleaned) as T;
  } catch (err) {
    throw new Error(
      `LLM returned invalid JSON for task ${opts.task} (model ${result.model}): ${(err as Error).message}\nRaw: ${result.raw.slice(0, 500)}`
    );
  }
  return { ...result, content: parsed };
}
