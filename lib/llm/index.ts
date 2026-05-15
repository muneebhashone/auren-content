import { getRoutingForTask } from "./router";
import { callGatewayChat, modelForProvider } from "./gateway";
import type { CallOptions, CallResult, ChatMessage } from "./types";

export type { ChatMessage, CallOptions, CallResult, LlmProvider, TaskRouting } from "./types";

function todayContextMessage(): ChatMessage {
  const d = new Date();
  const iso = d.toISOString().slice(0, 10);
  // e.g. "Mon, 04 May 2026"
  const human = d.toUTCString().slice(0, 16);
  return {
    role: "system",
    content: `CURRENT DATE: ${iso} (${human} UTC).

Our space (AI / dev tooling / SaaS) moves fast. When you mention models, frameworks, releases, pricing, news, or any time-sensitive fact:
- Treat anything older than 7 days as potentially stale; ideally rely only on the last 3 days.
- Never present prior-year material as "current", "new", "just announced", or "this week".
- If you are unsure something is still accurate, omit it rather than guess. Better fewer concrete signals than confident-sounding outdated ones.`,
  };
}

export async function callLLM(
  opts: CallOptions
): Promise<CallResult<string>> {
  const routing = await getRoutingForTask(opts.task);
  const provider = opts.providerOverride ?? routing.provider;
  const model = modelForProvider(provider, opts.modelOverride ?? routing.model);
  const reasoningEffort =
    opts.reasoningEffortOverride ??
    opts.claudeEffortOverride ??
    routing.reasoningEffort;

  const optsWithDate: CallOptions = {
    ...opts,
    messages: [todayContextMessage(), ...opts.messages],
  };

  return callGatewayChat(optsWithDate, model, reasoningEffort);
}

export async function callLLMJson<T>(
  opts: CallOptions
): Promise<CallResult<T>> {
  const result = await callLLM({ ...opts, json: true });
  const parsed = extractJson<T>(result.raw);
  if (parsed === undefined) {
    throw new Error(
      `LLM returned no parseable JSON for task ${opts.task} (provider ${result.provider}, model ${result.model}).\nRaw: ${result.raw.slice(0, 500)}`
    );
  }
  return { ...result, content: parsed };
}

function extractJson<T>(raw: string): T | undefined {
  const candidates: string[] = [];

  // 1. Fenced ```json ... ``` block (or plain ``` ... ``` block).
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) candidates.push(fenced[1].trim());

  // 2. Whole string after stripping a single leading/trailing fence pair.
  candidates.push(
    raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim()
  );

  // 3. First balanced {...} or [...] substring (works when the model wrote
  //    prose before/after the JSON without code fences).
  const balanced = findBalanced(raw);
  if (balanced) candidates.push(balanced);

  for (const c of candidates) {
    if (!c) continue;
    try {
      return JSON.parse(c) as T;
    } catch {
      // try next candidate
    }
  }
  return undefined;
}

function findBalanced(s: string): string | null {
  // Find first '{' or '[', then walk forward tracking string state and depth.
  for (let start = 0; start < s.length; start++) {
    const ch = s[start];
    if (ch !== "{" && ch !== "[") continue;
    const open = ch;
    const close = ch === "{" ? "}" : "]";
    let depth = 0;
    let inStr = false;
    let escape = false;
    for (let i = start; i < s.length; i++) {
      const c = s[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (inStr) {
        if (c === "\\") {
          escape = true;
          continue;
        }
        if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') {
        inStr = true;
        continue;
      }
      if (c === open) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) return s.slice(start, i + 1);
      }
    }
  }
  return null;
}
