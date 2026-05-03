"use server";

import { revalidatePath } from "next/cache";
import { importFeedbackCsv } from "@/lib/feedback/import";
import {
  getPerformanceDigest,
  clearPerformanceDigest,
} from "@/lib/feedback/pattern-digest";
import type { ImportSummary } from "@/lib/feedback/import";

export async function importCsvAction(
  _prev: ImportSummary | null,
  formData: FormData
): Promise<ImportSummary> {
  const csv = String(formData.get("csv") ?? "").trim();
  if (!csv) {
    return {
      inserted: 0,
      updated: 0,
      skipped: 1,
      errors: [{ rowNumber: 0, message: "Paste a CSV first." }],
    };
  }
  const summary = await importFeedbackCsv(csv);
  if (summary.inserted > 0 || summary.updated > 0) {
    await clearPerformanceDigest();
  }
  revalidatePath("/performance");
  return summary;
}

export async function refreshDigestAction(): Promise<void> {
  await getPerformanceDigest({ force: true });
  revalidatePath("/performance");
}
