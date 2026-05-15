import type { CallOptions, CallResult, LlmProvider, ReasoningEffort } from "./types";
import { DEFAULT_TEMP_BY_TASK } from "./types";

const LOG = process.env.LLM_LOG !== "0";

export interface GatewayCapabilities {
  text: boolean;
  imageInput: boolean;
  imageGeneration: boolean;
  videoGeneration: boolean;
  tools: boolean;
  streaming: boolean;
  jsonMode: boolean;
  reasoningEffort: boolean;
}

export interface GatewayProvider {
  id: string;
  capabilities: GatewayCapabilities;
  healthy: boolean;
  health_detail?: string;
  model_count: number;
}

export interface GatewayModel {
  id: string;
  object: "model";
  owned_by: string;
  provider: string;
  capabilities: GatewayCapabilities;
  created?: number;
  context_window?: number;
  description?: string;
}

interface GatewayList<T> {
  object: "list";
  data: T[];
}

interface GatewayChatResponse {
  choices?: { message?: { content?: string | null } }[];
  model?: string;
  usage?: CallResult["usage"];
}

export function getGatewayBaseUrl(): string {
  return (process.env.AI_GATEWAY_BASE_URL || "http://127.0.0.1:3000").replace(
    /\/+$/,
    ""
  );
}

export function providerFromModel(model: string): LlmProvider {
  const [provider] = model.split("/");
  return (provider || "gateway") as LlmProvider;
}

export function modelForProvider(provider: LlmProvider, model: string): string {
  if (model.startsWith(`${provider}/`)) return model;
  return `${provider}/${model}`;
}

export async function gatewayFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `${getGatewayBaseUrl()}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI gateway ${res.status} ${path}: ${text}`);
  }
  return (await res.json()) as T;
}

export async function listGatewayProviders(): Promise<GatewayProvider[]> {
  const data = await gatewayFetch<GatewayList<GatewayProvider>>("/v1/providers");
  return data.data;
}

export async function listGatewayModels(): Promise<GatewayModel[]> {
  const data = await gatewayFetch<GatewayList<GatewayModel>>("/v1/models");
  return data.data;
}

export async function listGatewayProviderModels(
  provider: string
): Promise<GatewayModel[]> {
  const data = await gatewayFetch<GatewayList<GatewayModel>>(
    `/v1/providers/${encodeURIComponent(provider)}/models`
  );
  return data.data;
}

export async function callGatewayChat(
  opts: CallOptions,
  model: string,
  reasoningEffort?: ReasoningEffort
): Promise<CallResult<string>> {
  const temperature = opts.temperature ?? DEFAULT_TEMP_BY_TASK[opts.task] ?? 0.6;
  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature,
    max_tokens: opts.maxTokens ?? 2400,
  };
  if (opts.json) body.response_format = { type: "json_object" };
  if (reasoningEffort) {
    body.reasoning_effort = reasoningEffort;
    body.reasoning = { effort: reasoningEffort };
  }
  if (opts.providerHints) body.provider = opts.providerHints;
  if (opts.extraBody) Object.assign(body, opts.extraBody);

  if (LOG) {
    const promptStr = flattenForLog(opts.messages);
    console.log(
      `[llm] -> gateway task=${opts.task} model=${model} json=${!!opts.json} temp=${temperature} promptChars=${promptStr.length}`
    );
    console.log(`[llm]   prompt: ${truncate(promptStr, 800)}`);
  }
  const startedAt = Date.now();

  const data = await gatewayFetch<GatewayChatResponse>("/v1/chat/completions", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const content = data.choices?.[0]?.message?.content ?? "";

  if (LOG) {
    const ms = Date.now() - startedAt;
    const u = data.usage;
    const usageStr = u
      ? `tokens=${u.prompt_tokens ?? "?"}/${u.completion_tokens ?? "?"}`
      : "tokens=?";
    console.log(
      `[llm] <- gateway task=${opts.task} model=${data.model ?? model} ${ms}ms ${usageStr} outChars=${content.length}`
    );
    console.log(`[llm]   output: ${truncate(content, 800)}`);
  }

  return {
    content,
    raw: content,
    model: data.model ?? model,
    provider: providerFromModel(data.model ?? model),
    usage: data.usage,
  };
}

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
  return s.length <= n ? s : s.slice(0, n) + `... [+${s.length - n} chars]`;
}
