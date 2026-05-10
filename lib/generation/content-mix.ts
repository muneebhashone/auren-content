import { db } from "@/lib/db/client";
import { settings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { safeJson } from "@/lib/utils";

const KEY = "content_mix";

export type ContentType = "research" | "story" | "fun" | "opinion";

export interface ContentMix {
  research: number;
  story: number;
  fun: number;
  opinion: number;
}

export const DEFAULT_MIX: ContentMix = {
  research: 50,
  story: 20,
  fun: 15,
  opinion: 15,
};

const KEYS: ContentType[] = ["research", "story", "fun", "opinion"];

function clampPct(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  const r = Math.round(n);
  if (r < 0) return 0;
  if (r > 100) return 100;
  return r;
}

// Normalize so the four values are non-negative integers summing to exactly 100.
// Largest field absorbs rounding remainder.
function normalize(mix: ContentMix): ContentMix {
  const clamped: ContentMix = {
    research: clampPct(mix.research),
    story: clampPct(mix.story),
    fun: clampPct(mix.fun),
    opinion: clampPct(mix.opinion),
  };
  const total = clamped.research + clamped.story + clamped.fun + clamped.opinion;
  if (total === 100) return clamped;
  if (total === 0) return { ...DEFAULT_MIX };

  // Scale proportionally, then absorb remainder into the currently-largest key.
  const scaled: ContentMix = {
    research: Math.floor((clamped.research * 100) / total),
    story: Math.floor((clamped.story * 100) / total),
    fun: Math.floor((clamped.fun * 100) / total),
    opinion: Math.floor((clamped.opinion * 100) / total),
  };
  const scaledTotal =
    scaled.research + scaled.story + scaled.fun + scaled.opinion;
  const remainder = 100 - scaledTotal;
  if (remainder !== 0) {
    let largestKey: ContentType = "research";
    for (const k of KEYS) {
      if (scaled[k] > scaled[largestKey]) largestKey = k;
    }
    scaled[largestKey] += remainder;
  }
  return scaled;
}

export async function getContentMix(): Promise<ContentMix> {
  const row = await db
    .select()
    .from(settings)
    .where(eq(settings.key, KEY))
    .limit(1);
  const parsed = safeJson<Partial<ContentMix>>(row[0]?.valueJson ?? null, {});
  const mix: ContentMix = {
    research:
      typeof parsed.research === "number" ? parsed.research : DEFAULT_MIX.research,
    story:
      typeof parsed.story === "number" ? parsed.story : DEFAULT_MIX.story,
    fun: typeof parsed.fun === "number" ? parsed.fun : DEFAULT_MIX.fun,
    opinion:
      typeof parsed.opinion === "number" ? parsed.opinion : DEFAULT_MIX.opinion,
  };
  return normalize(mix);
}

export async function setContentMix(mix: ContentMix): Promise<ContentMix> {
  const normalized = normalize(mix);
  const json = JSON.stringify(normalized);
  const existing = await db
    .select()
    .from(settings)
    .where(eq(settings.key, KEY))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(settings).values({ key: KEY, valueJson: json });
  } else {
    await db.update(settings).set({ valueJson: json }).where(eq(settings.key, KEY));
  }
  return normalized;
}

// Convert the percentage mix into integer slot counts that sum to exactly
// totalSlots, using largest-remainder (Hamilton) rounding.
export function computeMixSlotCounts(
  mix: ContentMix,
  totalSlots: number
): Record<ContentType, number> {
  if (totalSlots <= 0) return { research: 0, story: 0, fun: 0, opinion: 0 };
  const raw: Record<ContentType, number> = {
    research: (mix.research * totalSlots) / 100,
    story: (mix.story * totalSlots) / 100,
    fun: (mix.fun * totalSlots) / 100,
    opinion: (mix.opinion * totalSlots) / 100,
  };
  const floors: Record<ContentType, number> = {
    research: Math.floor(raw.research),
    story: Math.floor(raw.story),
    fun: Math.floor(raw.fun),
    opinion: Math.floor(raw.opinion),
  };
  let assigned = floors.research + floors.story + floors.fun + floors.opinion;
  const remainders: Array<{ key: ContentType; rem: number }> = KEYS.map((k) => ({
    key: k,
    rem: raw[k] - floors[k],
  }));
  remainders.sort((a, b) => b.rem - a.rem);
  let i = 0;
  while (assigned < totalSlots) {
    floors[remainders[i % remainders.length].key] += 1;
    assigned += 1;
    i += 1;
  }
  return floors;
}
