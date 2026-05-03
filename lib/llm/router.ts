import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { safeJson } from "@/lib/utils";

export type LlmTask =
  | "research"
  | "strategy"
  | "write"
  | "hook"
  | "polish"
  | "rationale"
  | "feedback-analysis";

// Defaults baked in. User can override per-task in Settings.
export const DEFAULT_MODELS: Record<LlmTask, string> = {
  // Web-search-capable for live trend grounding
  research: "perplexity/sonar-pro",
  // Long-context strategist
  strategy: "anthropic/claude-sonnet-4.5",
  // Voice-matching writer
  write: "anthropic/claude-sonnet-4.5",
  // Punchy hooks
  hook: "openai/gpt-4o",
  // Cheap, fast cleanup
  polish: "anthropic/claude-haiku-4.5",
  // Reasoning + citation alignment
  rationale: "anthropic/claude-sonnet-4.5",
  // Pattern recognition over performance corpus
  "feedback-analysis": "anthropic/claude-opus-4.1",
};

export async function getModelForTask(task: LlmTask): Promise<string> {
  const row = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "model_overrides"))
    .limit(1);
  const overrides = safeJson<Partial<Record<LlmTask, string>>>(
    row[0]?.valueJson ?? null,
    {}
  );
  return overrides[task] || DEFAULT_MODELS[task];
}

export async function getAllModelOverrides(): Promise<
  Partial<Record<LlmTask, string>>
> {
  const row = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "model_overrides"))
    .limit(1);
  return safeJson<Partial<Record<LlmTask, string>>>(
    row[0]?.valueJson ?? null,
    {}
  );
}

export async function setModelOverrides(
  overrides: Partial<Record<LlmTask, string>>
): Promise<void> {
  const json = JSON.stringify(overrides);
  const existing = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "model_overrides"))
    .limit(1);
  if (existing.length === 0) {
    await db
      .insert(settings)
      .values({ key: "model_overrides", valueJson: json });
  } else {
    await db
      .update(settings)
      .set({ valueJson: json })
      .where(eq(settings.key, "model_overrides"));
  }
}
