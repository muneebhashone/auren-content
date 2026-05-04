import type { LlmTask } from "./router";

export type LlmProvider = "openrouter" | "opencode" | "codex";
export type CodexReasoningEffort = "low" | "medium" | "high" | "xhigh";

export interface TaskRouting {
  provider: LlmProvider;
  model: string;
  reasoningEffort?: CodexReasoningEffort;
}

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
  /** Temperature; default 0.7 for write tasks, 0.3 for analytic ones. Ignored by CLI providers. */
  temperature?: number;
  /** Max output tokens. Ignored by CLI providers. */
  maxTokens?: number;
  /** Override the routed model (rare). Format: "model-id" — does not include provider prefix. */
  modelOverride?: string;
  /** Override the routed provider (rare). */
  providerOverride?: LlmProvider;
  /** Override Codex CLI reasoning effort. Ignored by non-Codex providers. */
  reasoningEffortOverride?: CodexReasoningEffort;
  /** Extra OpenRouter routing flags. Ignored by CLI providers. */
  providerHints?: Record<string, unknown>;
  /** Extra top-level fields merged into the OpenRouter request body (e.g. Perplexity's `search_recency_filter`). Ignored by CLI providers. */
  extraBody?: Record<string, unknown>;
}

export interface CallResult<T = string> {
  content: T;
  raw: string;
  model: string;
  provider: LlmProvider;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export const DEFAULT_TEMP_BY_TASK: Partial<Record<LlmTask, number>> = {
  research: 0.2,
  strategy: 0.5,
  write: 0.8,
  hook: 0.9,
  polish: 0.4,
  rationale: 0.3,
  "feedback-analysis": 0.3,
};
