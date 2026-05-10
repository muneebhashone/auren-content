"use server";

import { revalidatePath } from "next/cache";
import {
  setRoutingOverrides,
  type LlmTask,
} from "@/lib/llm/router";
import type {
  ClaudeEffort,
  CodexReasoningEffort,
  LlmProvider,
  TaskRouting,
} from "@/lib/llm/types";
import {
  setGenerationConcurrency,
  CONCURRENCY_DEFAULT,
} from "@/lib/generation/settings";
import { setContentMix, DEFAULT_MIX } from "@/lib/generation/content-mix";

const TASKS: LlmTask[] = [
  "research",
  "strategy",
  "write",
  "hook",
  "polish",
  "rationale",
  "feedback-analysis",
];

function parseProvider(raw: FormDataEntryValue | null): LlmProvider | null {
  if (typeof raw !== "string") return null;
  if (
    raw === "openrouter" ||
    raw === "opencode" ||
    raw === "codex" ||
    raw === "claude"
  ) {
    return raw;
  }
  return null;
}

function parseReasoningEffort(
  raw: FormDataEntryValue | null
): CodexReasoningEffort | undefined {
  if (typeof raw !== "string") return undefined;
  if (raw === "low" || raw === "medium" || raw === "high" || raw === "xhigh") {
    return raw;
  }
  return undefined;
}

function parseClaudeEffort(raw: FormDataEntryValue | null): ClaudeEffort | undefined {
  if (typeof raw !== "string") return undefined;
  if (
    raw === "low" ||
    raw === "medium" ||
    raw === "high" ||
    raw === "xhigh" ||
    raw === "max"
  ) {
    return raw;
  }
  return undefined;
}

export async function saveOverridesAction(formData: FormData) {
  const overrides: Partial<Record<LlmTask, TaskRouting>> = {};
  for (const task of TASKS) {
    const provider = parseProvider(formData.get(`override:${task}:provider`));
    const rawModel = formData.get(`override:${task}:model`);
    const model = typeof rawModel === "string" ? rawModel.trim() : "";
    if (provider && model.length > 0) {
      const reasoningEffort = parseReasoningEffort(
        formData.get(`override:${task}:reasoning`)
      );
      const claudeEffort = parseClaudeEffort(
        formData.get(`override:${task}:claudeEffort`)
      );
      overrides[task] = {
        provider,
        model,
        ...(provider === "codex" && reasoningEffort ? { reasoningEffort } : {}),
        ...(provider === "claude" && claudeEffort ? { claudeEffort } : {}),
      };
    }
  }
  await setRoutingOverrides(overrides);
  revalidatePath("/settings");
}

export async function resetOverridesAction() {
  await setRoutingOverrides({});
  revalidatePath("/settings");
}

export async function saveGenerationConcurrencyAction(formData: FormData) {
  const raw = formData.get("generation_concurrency");
  const parsed =
    typeof raw === "string" && raw.trim().length > 0
      ? Number(raw)
      : CONCURRENCY_DEFAULT;
  await setGenerationConcurrency(parsed);
  revalidatePath("/settings");
}

function readPct(raw: FormDataEntryValue | null, fallback: number): number {
  if (typeof raw !== "string" || raw.trim().length === 0) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export async function saveContentMixAction(formData: FormData) {
  await setContentMix({
    research: readPct(formData.get("mix_research"), DEFAULT_MIX.research),
    story: readPct(formData.get("mix_story"), DEFAULT_MIX.story),
    fun: readPct(formData.get("mix_fun"), DEFAULT_MIX.fun),
    opinion: readPct(formData.get("mix_opinion"), DEFAULT_MIX.opinion),
  });
  revalidatePath("/settings");
}
