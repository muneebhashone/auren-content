import { inArray, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { performanceRecords, posts } from "@/lib/db/schema";
import { parseFeedbackCsv, type FeedbackRowError } from "./csv-parser";

export interface ImportSummary {
  inserted: number;
  updated: number;
  skipped: number;
  errors: FeedbackRowError[];
}

export async function importFeedbackCsv(csv: string): Promise<ImportSummary> {
  const { rows, errors } = parseFeedbackCsv(csv);
  const allErrors: FeedbackRowError[] = [...errors];

  if (rows.length === 0) {
    return { inserted: 0, updated: 0, skipped: 0, errors: allErrors };
  }

  const ids = Array.from(new Set(rows.map((r) => r.postId)));
  const existing = await db
    .select({ id: posts.id })
    .from(posts)
    .where(inArray(posts.id, ids));
  const validIds = new Set(existing.map((r) => r.id));

  const valid = rows.filter((r) => {
    if (!validIds.has(r.postId)) {
      allErrors.push({
        rowNumber: r.rowNumber,
        message: `Unknown post_id ${r.postId}`,
      });
      return false;
    }
    return true;
  });

  const dedup = new Map<number, (typeof valid)[number]>();
  for (const row of valid) dedup.set(row.postId, row);

  let inserted = 0;
  let updated = 0;

  if (dedup.size > 0) {
    const existingRecords = await db
      .select({ postId: performanceRecords.postId })
      .from(performanceRecords)
      .where(inArray(performanceRecords.postId, Array.from(dedup.keys())));
    const existingSet = new Set(existingRecords.map((r) => r.postId));

    const now = new Date().toISOString();
    for (const row of dedup.values()) {
      if (existingSet.has(row.postId)) {
        await db
          .update(performanceRecords)
          .set({
            impressions: row.impressions,
            likes: row.likes,
            comments: row.comments,
            reposts: row.reposts,
            qualitativeNote: row.qualitativeNote,
            importedAt: now,
          })
          .where(eq(performanceRecords.postId, row.postId));
        updated += 1;
      } else {
        await db.insert(performanceRecords).values({
          postId: row.postId,
          impressions: row.impressions,
          likes: row.likes,
          comments: row.comments,
          reposts: row.reposts,
          qualitativeNote: row.qualitativeNote,
          importedAt: now,
        });
        inserted += 1;
      }
    }
  }

  return {
    inserted,
    updated,
    skipped: allErrors.length,
    errors: allErrors,
  };
}
