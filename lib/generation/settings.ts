import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { safeJson } from "@/lib/utils";

const KEY = "generation_concurrency";
export const CONCURRENCY_DEFAULT = 3;
export const CONCURRENCY_MIN = 1;
export const CONCURRENCY_MAX = 10;

interface StoredShape {
  value?: number;
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return CONCURRENCY_DEFAULT;
  const r = Math.round(n);
  if (r < CONCURRENCY_MIN) return CONCURRENCY_MIN;
  if (r > CONCURRENCY_MAX) return CONCURRENCY_MAX;
  return r;
}

export async function getGenerationConcurrency(): Promise<number> {
  const row = await db
    .select()
    .from(settings)
    .where(eq(settings.key, KEY))
    .limit(1);
  const parsed = safeJson<StoredShape>(row[0]?.valueJson ?? null, {});
  if (typeof parsed.value !== "number") return CONCURRENCY_DEFAULT;
  return clamp(parsed.value);
}

export async function setGenerationConcurrency(value: number): Promise<void> {
  const clamped = clamp(value);
  const json = JSON.stringify({ value: clamped });
  const existing = await db
    .select()
    .from(settings)
    .where(eq(settings.key, KEY))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(settings).values({ key: KEY, valueJson: json });
  } else {
    await db
      .update(settings)
      .set({ valueJson: json })
      .where(eq(settings.key, KEY));
  }
}
