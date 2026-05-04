"use server";

import { revalidatePath } from "next/cache";
import {
  setRoutingOverrides,
  type LlmTask,
} from "@/lib/llm/router";
import type {
  CodexReasoningEffort,
  LlmProvider,
  TaskRouting,
} from "@/lib/llm/types";
import {
  setGenerationConcurrency,
  CONCURRENCY_DEFAULT,
} from "@/lib/generation/settings";

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
  if (raw === "openrouter" || raw === "opencode" || raw === "codex") return raw;
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
      overrides[task] = {
        provider,
        model,
        ...(provider === "codex" && reasoningEffort ? { reasoningEffort } : {}),
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
