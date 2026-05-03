import { db } from "@/lib/db/client";
import {
  businessProfile,
  performanceRecords,
  personas,
  posts as postsTable,
  quarterlyGoals,
  researchSignals,
  weeklyBriefs,
} from "@/lib/db/schema";
import { and, desc, eq, ne } from "drizzle-orm";
import { safeJson } from "@/lib/utils";
import { callLLMJson } from "@/lib/llm/openrouter";
import {
  buildBriefSuggesterPrompt,
  type BriefSuggesterOutput,
} from "@/lib/llm/prompts/brief-suggester";
import {
  buildFeedbackAnalysisPrompt,
  type FeedbackAnalysisOutput,
} from "@/lib/llm/prompts/feedback-analysis";

async function ensureBrief(isoWeek: string) {
  const existing = (
    await db
      .select()
      .from(weeklyBriefs)
      .where(eq(weeklyBriefs.isoWeek, isoWeek))
      .limit(1)
  )[0];
  if (existing) return existing;
  const [created] = await db
    .insert(weeklyBriefs)
    .values({ isoWeek, focus: "", targetSegment: "", notes: "" })
    .returning();
  return created;
}

async function shortPerformanceDigest(): Promise<string> {
  const rows = await db
    .select({
      id: postsTable.id,
      platform: postsTable.platform,
      hook: postsTable.hook,
      body: postsTable.body,
      personaName: personas.name,
      impressions: performanceRecords.impressions,
      likes: performanceRecords.likes,
      comments: performanceRecords.comments,
      reposts: performanceRecords.reposts,
      qualitativeNote: performanceRecords.qualitativeNote,
    })
    .from(performanceRecords)
    .innerJoin(postsTable, eq(performanceRecords.postId, postsTable.id))
    .innerJoin(personas, eq(postsTable.personaId, personas.id))
    .orderBy(desc(performanceRecords.importedAt))
    .limit(30);

  if (rows.length < 3) return "";
  try {
    const result = await callLLMJson<FeedbackAnalysisOutput>({
      task: "feedback-analysis",
      messages: buildFeedbackAnalysisPrompt({
        posts: rows.map((r) => ({
          id: r.id,
          platform: r.platform as "x" | "linkedin",
          persona: r.personaName,
          hook: r.hook,
          body: r.body,
          impressions: r.impressions,
          likes: r.likes,
          comments: r.comments,
          reposts: r.reposts,
          qualitativeNote: r.qualitativeNote,
        })),
      }),
      maxTokens: 900,
    });
    const c = result.content;
    return [
      c.summary,
      c.what_works.length ? `Works: ${c.what_works.join("; ")}` : "",
      c.what_misses.length ? `Misses: ${c.what_misses.join("; ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    return "";
  }
}

export interface SuggestBriefResult {
  focus: string;
  target_segment: string;
  notes: string;
  reasoning: string;
  alt_angles: BriefSuggesterOutput["alt_angles"];
}

export async function suggestWeeklyBrief(
  isoWeek: string
): Promise<SuggestBriefResult> {
  const profileRow = (await db.select().from(businessProfile).limit(1))[0];
  if (!profileRow) throw new Error("Business profile not configured.");

  const allPersonas = await db
    .select()
    .from(personas)
    .where(eq(personas.active, true));

  const goalRow = (
    await db
      .select()
      .from(quarterlyGoals)
      .where(eq(quarterlyGoals.active, true))
      .limit(1)
  )[0];

  const brief = await ensureBrief(isoWeek);

  // Recent briefs (excluding this one) for novelty enforcement
  const recentBriefs = await db
    .select()
    .from(weeklyBriefs)
    .where(ne(weeklyBriefs.isoWeek, isoWeek))
    .orderBy(desc(weeklyBriefs.createdAt))
    .limit(4);

  // Recent posts to show what was already said
  const recentPosts = await db
    .select({
      hook: postsTable.hook,
      platform: postsTable.platform,
      createdAt: postsTable.createdAt,
      personaName: personas.name,
    })
    .from(postsTable)
    .innerJoin(personas, eq(postsTable.personaId, personas.id))
    .orderBy(desc(postsTable.createdAt))
    .limit(20);

  // Existing signals for this week (don't trigger fresh research here — this is the brief step;
  // signals fetched separately keep the loop fast and idempotent)
  const signalRows = await db
    .select()
    .from(researchSignals)
    .where(eq(researchSignals.weekId, brief.id));

  const performanceDigest = await shortPerformanceDigest();

  const services = safeJson<Array<{ name: string }>>(
    profileRow.servicesJson,
    []
  ).map((s) => s.name);

  const result = await callLLMJson<BriefSuggesterOutput>({
    task: "strategy",
    messages: buildBriefSuggesterPrompt({
      isoWeek,
      region: profileRow.region,
      icp: profileRow.icp,
      services,
      brandPillars: profileRow.brandPillars,
      antiGoals: profileRow.antiGoals,
      voiceGlobal: profileRow.voiceGlobal,
      activeGoal: goalRow
        ? {
            objective: goalRow.objective,
            narrative: goalRow.narrative,
            successMetrics: goalRow.successMetrics,
          }
        : null,
      recentBriefs: recentBriefs.map((b) => ({
        isoWeek: b.isoWeek,
        focus: b.focus,
      })),
      recentPosts: recentPosts.map((p) => ({
        persona: p.personaName,
        platform: p.platform,
        hook: p.hook,
        createdAt: p.createdAt,
      })),
      signals: signalRows.map((s) => ({
        id: s.id,
        summary: s.summary,
        kind: s.kind,
        sourceUrl: s.sourceUrl,
      })),
      performanceDigest,
      personasSummary: allPersonas.map((p) => ({
        name: p.name,
        role: p.role,
        cadence: safeJson<Record<string, number>>(p.cadenceJson, {}),
      })),
    }),
    maxTokens: 1800,
  });

  const out = result.content;

  await db
    .update(weeklyBriefs)
    .set({
      focus: out.focus,
      targetSegment: out.target_segment,
      notes: out.notes,
      suggestedIdeasJson: JSON.stringify({
        reasoning: out.reasoning,
        alt_angles: out.alt_angles ?? [],
      }),
      suggestedAt: new Date().toISOString(),
    })
    .where(eq(weeklyBriefs.id, brief.id));

  return {
    focus: out.focus,
    target_segment: out.target_segment,
    notes: out.notes,
    reasoning: out.reasoning,
    alt_angles: out.alt_angles ?? [],
  };
}
