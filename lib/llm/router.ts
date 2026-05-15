import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { safeJson } from "@/lib/utils";
import type { LlmProvider, ReasoningEffort, TaskRouting } from "./types";
import { modelForProvider, providerFromModel } from "./gateway";

export type LlmTask =
  | "research"
  | "strategy"
  | "write"
  | "hook"
  | "polish"
  | "rationale"
  | "feedback-analysis";

export const DEFAULT_ROUTING: Record<LlmTask, TaskRouting> = {
  research: {
    provider: "openrouter",
    model: "openrouter/perplexity/sonar-pro",
  },
  strategy: {
    provider: "openrouter",
    model: "openrouter/anthropic/claude-sonnet-4.5",
  },
  write: {
    provider: "openrouter",
    model: "openrouter/anthropic/claude-sonnet-4.5",
  },
  hook: { provider: "openrouter", model: "openrouter/openai/gpt-4o" },
  polish: {
    provider: "openrouter",
    model: "openrouter/anthropic/claude-haiku-4.5",
  },
  rationale: {
    provider: "openrouter",
    model: "openrouter/anthropic/claude-sonnet-4.5",
  },
  "feedback-analysis": {
    provider: "openrouter",
    model: "openrouter/anthropic/claude-opus-4.1",
  },
};

const SETTINGS_KEY = "model_overrides";

type StoredRoute = TaskRouting & { claudeEffort?: ReasoningEffort };
type StoredOverrides = Partial<Record<LlmTask, StoredRoute | string>>;

function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return (
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "xhigh" ||
    value === "max"
  );
}

function normalizeProvider(provider: string | undefined, model: string): LlmProvider {
  if (provider === "claude") return "claude-code";
  if (provider) return provider as LlmProvider;
  return providerFromModel(model);
}

function normalizeRoute(
  provider: string | undefined,
  model: string,
  reasoningEffort?: unknown,
  claudeEffort?: unknown
): TaskRouting {
  const normalizedProvider = normalizeProvider(provider, model);
  const normalizedModel = model.includes("/")
    ? modelForProvider(normalizedProvider, stripLegacyProvider(model, provider))
    : modelForProvider(normalizedProvider, model);
  const effort = isReasoningEffort(reasoningEffort)
    ? reasoningEffort
    : isReasoningEffort(claudeEffort)
      ? claudeEffort
      : undefined;

  return {
    provider: normalizedProvider,
    model: normalizedModel,
    ...(effort ? { reasoningEffort: effort } : {}),
  };
}

function stripLegacyProvider(model: string, provider: string | undefined): string {
  if (!provider) return model;
  const normalizedProvider = provider === "claude" ? "claude-code" : provider;
  if (model.startsWith(`${normalizedProvider}/`)) return model.slice(normalizedProvider.length + 1);
  return model;
}

function normalize(raw: StoredOverrides): Partial<Record<LlmTask, TaskRouting>> {
  const out: Partial<Record<LlmTask, TaskRouting>> = {};
  for (const [task, value] of Object.entries(raw) as Array<
    [LlmTask, StoredRoute | string | undefined]
  >) {
    if (!value) continue;
    if (typeof value === "string") {
      out[task] = normalizeRoute("openrouter", value);
    } else if (
      value &&
      typeof value === "object" &&
      typeof value.model === "string"
    ) {
      out[task] = normalizeRoute(
        value.provider,
        value.model,
        value.reasoningEffort,
        value.claudeEffort
      );
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
  const normalized: Partial<Record<LlmTask, TaskRouting>> = {};
  for (const [task, route] of Object.entries(overrides) as Array<
    [LlmTask, TaskRouting | undefined]
  >) {
    if (!route?.model) continue;
    normalized[task] = normalizeRoute(route.provider, route.model, route.reasoningEffort);
  }

  const json = JSON.stringify(normalized);
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
