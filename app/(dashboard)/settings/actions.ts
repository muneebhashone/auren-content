"use server";

import { revalidatePath } from "next/cache";
import {
  setModelOverrides,
  type LlmTask,
} from "@/lib/llm/router";

const TASKS: LlmTask[] = [
  "research",
  "strategy",
  "write",
  "hook",
  "polish",
  "rationale",
  "feedback-analysis",
];

export async function saveOverridesAction(formData: FormData) {
  const overrides: Partial<Record<LlmTask, string>> = {};
  for (const task of TASKS) {
    const raw = formData.get(`override:${task}`);
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed.length > 0) overrides[task] = trimmed;
    }
  }
  await setModelOverrides(overrides);
  revalidatePath("/settings");
}

export async function resetOverridesAction() {
  await setModelOverrides({});
  revalidatePath("/settings");
}
