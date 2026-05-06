import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { performanceRecords, personas, posts, settings } from "@/lib/db/schema";
import { safeJson } from "@/lib/utils";
import { callLLMJson } from "@/lib/llm";
import {
  buildFeedbackAnalysisPrompt,
  type FeedbackAnalysisInput,
  type FeedbackAnalysisOutput,
} from "@/lib/llm/prompts/feedback-analysis";

const SETTINGS_KEY = "performance_digest";
const TTL_MS = 24 * 60 * 60 * 1000;
const MIN_RECORDS = 3;

export interface CachedDigest {
  digest: FeedbackAnalysisOutput;
  computedAt: string;
}

export interface DigestResult {
  digest: FeedbackAnalysisOutput | null;
  computedAt: string | null;
  insufficient?: boolean;
  recordCount: number;
}

async function loadCorpus(): Promise<FeedbackAnalysisInput["posts"]> {
  const rows = await db
    .select({
      id: posts.id,
      platform: posts.platform,
      hook: posts.hook,
      body: posts.body,
      personaName: personas.name,
      impressions: performanceRecords.impressions,
      likes: performanceRecords.likes,
      comments: performanceRecords.comments,
      reposts: performanceRecords.reposts,
      qualitativeNote: performanceRecords.qualitativeNote,
    })
    .from(performanceRecords)
    .innerJoin(posts, eq(performanceRecords.postId, posts.id))
    .innerJoin(personas, eq(posts.personaId, personas.id));

  return rows.map((r) => ({
    id: r.id,
    platform:
      r.platform === "linkedin"
        ? ("linkedin" as const)
        : r.platform === "reddit"
          ? ("reddit" as const)
          : ("x" as const),
    persona: r.personaName,
    hook: r.hook,
    body: r.body,
    impressions: r.impressions,
    likes: r.likes,
    comments: r.comments,
    reposts: r.reposts,
    qualitativeNote: r.qualitativeNote,
  }));
}

async function readCache(): Promise<CachedDigest | null> {
  const row = (
    await db.select().from(settings).where(eq(settings.key, SETTINGS_KEY)).limit(1)
  )[0];
  if (!row) return null;
  return safeJson<CachedDigest | null>(row.valueJson, null);
}

async function writeCache(value: CachedDigest): Promise<void> {
  const json = JSON.stringify(value);
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

export async function getPerformanceDigest(opts?: {
  force?: boolean;
}): Promise<DigestResult> {
  const corpus = await loadCorpus();
  const recordCount = corpus.length;

  if (recordCount < MIN_RECORDS) {
    return {
      digest: null,
      computedAt: null,
      insufficient: true,
      recordCount,
    };
  }

  if (!opts?.force) {
    const cached = await readCache();
    if (cached) {
      const age = Date.now() - new Date(cached.computedAt).getTime();
      if (Number.isFinite(age) && age < TTL_MS) {
        return {
          digest: cached.digest,
          computedAt: cached.computedAt,
          recordCount,
        };
      }
    }
  }

  const messages = buildFeedbackAnalysisPrompt({ posts: corpus });
  const { content } = await callLLMJson<FeedbackAnalysisOutput>({
    task: "feedback-analysis",
    messages,
  });

  const computedAt = new Date().toISOString();
  await writeCache({ digest: content, computedAt });

  return { digest: content, computedAt, recordCount };
}

export async function clearPerformanceDigest(): Promise<void> {
  const existing = await db
    .select()
    .from(settings)
    .where(eq(settings.key, SETTINGS_KEY))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(settings)
      .set({ valueJson: JSON.stringify(null) })
      .where(eq(settings.key, SETTINGS_KEY));
  }
}
