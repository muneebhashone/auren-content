"use server";

import { revalidatePath } from "next/cache";
import {
  setRoutingOverrides,
  type LlmTask,
} from "@/lib/llm/router";
import type { LlmProvider, TaskRouting } from "@/lib/llm/types";
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
  if (raw === "openrouter" || raw === "opencode") return raw;
  return null;
}

export async function saveOverridesAction(formData: FormData) {
  const overrides: Partial<Record<LlmTask, TaskRouting>> = {};
  for (const task of TASKS) {
    const provider = parseProvider(formData.get(`override:${task}:provider`));
    const rawModel = formData.get(`override:${task}:model`);
    const model = typeof rawModel === "string" ? rawModel.trim() : "";
    if (provider && model.length > 0) {
      overrides[task] = { provider, model };
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
