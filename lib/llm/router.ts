import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { safeJson } from "@/lib/utils";
import type { CodexReasoningEffort, LlmProvider, TaskRouting } from "./types";

export type LlmTask =
  | "research"
  | "strategy"
  | "write"
  | "hook"
  | "polish"
  | "rationale"
  | "feedback-analysis";

// Defaults baked in. User can override per-task in Settings.
export const DEFAULT_ROUTING: Record<LlmTask, TaskRouting> = {
  // Web-search-capable for live trend grounding
  research: { provider: "openrouter", model: "perplexity/sonar-pro" },
  // Long-context strategist
  strategy: { provider: "openrouter", model: "anthropic/claude-sonnet-4.5" },
  // Voice-matching writer
  write: { provider: "openrouter", model: "anthropic/claude-sonnet-4.5" },
  // Punchy hooks
  hook: { provider: "openrouter", model: "openai/gpt-4o" },
  // Cheap, fast cleanup
  polish: { provider: "openrouter", model: "anthropic/claude-haiku-4.5" },
  // Reasoning + citation alignment
  rationale: { provider: "openrouter", model: "anthropic/claude-sonnet-4.5" },
  // Pattern recognition over performance corpus
  "feedback-analysis": {
    provider: "openrouter",
    model: "anthropic/claude-opus-4.1",
  },
};

const SETTINGS_KEY = "model_overrides";

type StoredOverrides = Partial<Record<LlmTask, TaskRouting | string>>;

function isCodexReasoningEffort(value: unknown): value is CodexReasoningEffort {
  return value === "low" || value === "medium" || value === "high" || value === "xhigh";
}

function normalize(
  raw: StoredOverrides
): Partial<Record<LlmTask, TaskRouting>> {
  const out: Partial<Record<LlmTask, TaskRouting>> = {};
  for (const [task, value] of Object.entries(raw) as Array<
    [LlmTask, TaskRouting | string | undefined]
  >) {
    if (!value) continue;
    if (typeof value === "string") {
      // Legacy string format — assume openrouter
      out[task] = { provider: "openrouter", model: value };
    } else if (
      value &&
      typeof value === "object" &&
      typeof value.model === "string" &&
      (value.provider === "openrouter" ||
        value.provider === "opencode" ||
        value.provider === "codex")
    ) {
      out[task] = {
        provider: value.provider,
        model: value.model,
        ...(value.provider === "codex" && isCodexReasoningEffort(value.reasoningEffort)
          ? { reasoningEffort: value.reasoningEffort }
          : {}),
      };
    }
  }
  return out;
}

async function loadOverrides(): Promise<Partial<Record<LlmTask, TaskRouting>>> {
  const row = await db
    .select()
    .from(settings)
    .where(eq(settings.key, SETTINGS_KEY))
    .limit(1);
  const parsed = safeJson<StoredOverrides>(row[0]?.valueJson ?? null, {});
  return normalize(parsed);
}

export async function getRoutingForTask(task: LlmTask): Promise<TaskRouting> {
  const overrides = await loadOverrides();
  return overrides[task] ?? DEFAULT_ROUTING[task];
}

export async function getAllRoutingOverrides(): Promise<
  Partial<Record<LlmTask, TaskRouting>>
> {
  return loadOverrides();
}

export async function setRoutingOverrides(
  overrides: Partial<Record<LlmTask, TaskRouting>>
): Promise<void> {
  const json = JSON.stringify(overrides);
  const existing = await db
    .select()
    .from(settings)
    .where(eq(settings.key, SETTINGS_KEY))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(settings).values({ key: SETTINGS_KEY, valueJson: json });
  } else {
    await db
      .update(settings)
      .set({ valueJson: json })
      .where(eq(settings.key, SETTINGS_KEY));
  }
}

export type { LlmProvider, TaskRouting };
