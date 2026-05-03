import { db } from "@/lib/db/client";
import {
  businessProfile,
  performanceRecords,
  personas,
  posts as postsTable,
  quarterlyGoals,
  rationaleCitations,
  researchSignals,
  weeklyBriefs,
} from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { safeJson } from "@/lib/utils";
import { callLLMJson } from "@/lib/llm/openrouter";
import {
  buildResearchPrompt,
  type ResearchSignalOut,
} from "@/lib/llm/prompts/research";
import {
  buildStrategyPrompt,
  type WeekPlan,
  type SlotPlan,
} from "@/lib/llm/prompts/strategy";
import {
  buildWriterPrompt,
  type WriterOutput,
} from "@/lib/llm/prompts/writer";
import {
  buildHookCriticPrompt,
  type HookCriticOutput,
} from "@/lib/llm/prompts/hook-critic";
import {
  buildPolishPrompt,
  type PolishOutput,
} from "@/lib/llm/prompts/polish";
import {
  buildRationalePrompt,
  type RationaleOutput,
} from "@/lib/llm/prompts/rationale";
import {
  buildFeedbackAnalysisPrompt,
  type FeedbackAnalysisOutput,
} from "@/lib/llm/prompts/feedback-analysis";

export interface GenerationResult {
  weekId: number;
  isoWeek: string;
  postsCreated: number;
  signalsFetched: number;
}

async function getOrCreateBrief(isoWeek: string) {
  const existing = await db
    .select()
    .from(weeklyBriefs)
    .where(eq(weeklyBriefs.isoWeek, isoWeek))
    .limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db
    .insert(weeklyBriefs)
    .values({ isoWeek, focus: "", targetSegment: "", notes: "" })
    .returning();
  return created;
}

export async function runResearch(
  isoWeek: string,
  opts: { skipIfRecent?: boolean } = {}
): Promise<{ signalsFetched: number; weekId: number }> {
  const profileRow = (await db.select().from(businessProfile).limit(1))[0];
  if (!profileRow) throw new Error("Business profile not configured.");
  const brief = await getOrCreateBrief(isoWeek);

  if (opts.skipIfRecent) {
    const existing = await db
      .select()
      .from(researchSignals)
      .where(
        and(
          eq(researchSignals.weekId, brief.id),
          eq(researchSignals.kind, "trend")
        )
      );
    if (existing.length > 0) return { signalsFetched: 0, weekId: brief.id };
  }

  const services = safeJson<Array<{ name: string }>>(
    profileRow.servicesJson,
    []
  ).map((s) => s.name);

  const messages = buildResearchPrompt({
    region: profileRow.region,
    icp: profileRow.icp,
    services,
    brandPillars: profileRow.brandPillars,
    weeklyFocus: brief.focus,
    targetSegment: brief.targetSegment,
  });
  const result = await callLLMJson<{ signals: ResearchSignalOut[] }>({
    task: "research",
    messages,
    maxTokens: 2200,
  });

  const signals = result.content.signals ?? [];
  if (signals.length === 0) return { signalsFetched: 0, weekId: brief.id };

  await db.insert(researchSignals).values(
    signals.map((s) => ({
      weekId: brief.id,
      sourceUrl: s.source_url ?? "",
      summary: s.summary,
      kind: s.kind,
    }))
  );
  return { signalsFetched: signals.length, weekId: brief.id };
}

async function buildPerformanceDigest(): Promise<string> {
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
    .limit(40);

  if (rows.length < 3) return "";

  const messages = buildFeedbackAnalysisPrompt({
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
  });
  try {
    const result = await callLLMJson<FeedbackAnalysisOutput>({
      task: "feedback-analysis",
      messages,
      maxTokens: 1200,
    });
    const c = result.content;
    return [
      c.summary,
      c.what_works.length ? `What works: ${c.what_works.join("; ")}` : "",
      c.what_misses.length ? `What misses: ${c.what_misses.join("; ")}` : "",
      c.recommendations.length
        ? `Recommendations: ${c.recommendations.join("; ")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    return "";
  }
}

function isoDateInWeek(isoWeek: string, dayIndex: number, hour: number): string {
  // dayIndex: 0=Mon..6=Sun
  const [yearStr, weekStr] = isoWeek.split("-W");
  const year = Number(yearStr);
  const week = Number(weekStr);
  // ISO week 1 = the week with Jan 4
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const week1Mon = new Date(jan4);
  week1Mon.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const target = new Date(week1Mon);
  target.setUTCDate(week1Mon.getUTCDate() + (week - 1) * 7 + dayIndex);
  target.setUTCHours(hour, 0, 0, 0);
  return target.toISOString();
}

async function generateOneSlot(
  slot: SlotPlan,
  ctx: {
    weekTheme: string;
    profileVoice: string;
    persona: typeof personas.$inferSelect;
    signalsById: Map<number, { id: number; summary: string; sourceUrl: string }>;
    topPerformers: string;
    goalObjective?: string;
    weekId: number;
  }
): Promise<{
  postId: number;
}> {
  const { persona, signalsById } = ctx;
  const slotSignals = (slot.signal_ids ?? [])
    .map((id) => signalsById.get(id))
    .filter((s): s is { id: number; summary: string; sourceUrl: string } => !!s);

  // 1. Writer
  const writerResp = await callLLMJson<WriterOutput>({
    task: "write",
    messages: buildWriterPrompt({
      persona: {
        name: persona.name,
        role: persona.role,
        voiceProfileMd: persona.voiceProfileMd,
        dos: persona.dos,
        donts: persona.donts,
        samplePhrases: persona.samplePhrases,
      },
      brandVoiceGlobal: ctx.profileVoice,
      platform: slot.platform,
      theme: slot.theme,
      hookAngle: slot.hook_angle,
      weekTheme: ctx.weekTheme,
      signals: slotSignals,
      topPerformers: ctx.topPerformers,
    }),
    maxTokens: 1200,
  });
  const draft = writerResp.content;

  // 2. Hook critic
  let altHooks: HookCriticOutput["alt_hooks"] = [];
  try {
    const critic = await callLLMJson<HookCriticOutput>({
      task: "hook",
      messages: buildHookCriticPrompt({
        platform: slot.platform,
        currentHook: draft.hook,
        body: draft.body,
        personaName: persona.name,
        voiceProfileMd: persona.voiceProfileMd,
        dos: persona.dos,
        donts: persona.donts,
      }),
      maxTokens: 500,
    });
    altHooks = critic.content.alt_hooks ?? [];
  } catch (err) {
    console.warn("Hook critic failed, continuing:", (err as Error).message);
  }

  // 3. Polish
  let polished: PolishOutput = {
    hook: draft.hook,
    body: draft.body,
    hashtags: draft.hashtags ?? [],
  };
  try {
    const polishResp = await callLLMJson<PolishOutput>({
      task: "polish",
      messages: buildPolishPrompt({
        platform: slot.platform,
        hook: draft.hook,
        body: draft.body,
        hashtags: draft.hashtags ?? [],
        donts: persona.donts,
      }),
      maxTokens: 700,
    });
    polished = polishResp.content;
  } catch (err) {
    console.warn("Polish failed, keeping draft:", (err as Error).message);
  }

  // 4. Insert post first so we have an id for citations
  const [inserted] = await db
    .insert(postsTable)
    .values({
      weekId: ctx.weekId,
      personaId: persona.id,
      platform: slot.platform,
      scheduledFor: slot.scheduled_for,
      status: "draft",
      hook: polished.hook,
      body: polished.body,
      hashtagsJson: JSON.stringify(polished.hashtags),
      imagePrompt: draft.image_prompt ?? "",
      altHooksJson: JSON.stringify(altHooks),
      rationaleJson: "{}",
    })
    .returning();

  // 5. Rationale + citations
  try {
    const rationaleResp = await callLLMJson<RationaleOutput>({
      task: "rationale",
      messages: buildRationalePrompt({
        platform: slot.platform,
        scheduledFor: slot.scheduled_for,
        hook: polished.hook,
        body: polished.body,
        weekTheme: ctx.weekTheme,
        slotTheme: slot.theme,
        hookAngle: slot.hook_angle,
        whyThisSlot: slot.why_this_slot,
        personaName: persona.name,
        signalIds: slot.signal_ids ?? [],
        signals: slotSignals,
        topPerformersSummary: ctx.topPerformers,
        goalObjective: ctx.goalObjective,
      }),
      maxTokens: 900,
    });
    const r = rationaleResp.content;
    await db
      .update(postsTable)
      .set({
        rationaleJson: JSON.stringify({
          hookStrategy: r.hookStrategy,
          audience: r.audience,
          slotReasoning: r.slotReasoning,
          viralityLever: r.viralityLever,
          expectedOutcome: r.expectedOutcome,
        }),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(postsTable.id, inserted.id));

    if (Array.isArray(r.citations) && r.citations.length > 0) {
      await db.insert(rationaleCitations).values(
        r.citations.map((c) => ({
          postId: inserted.id,
          claimKey: c.claim_key,
          claim: c.claim,
          sourceKind: c.source_kind,
          sourceId: c.source_id,
        }))
      );
    }
  } catch (err) {
    console.warn(
      "Rationale failed for post",
      inserted.id,
      (err as Error).message
    );
  }

  return { postId: inserted.id };
}

export async function generateWeek(
  isoWeek: string
): Promise<GenerationResult> {
  // 1. Load all context
  const profileRow = (await db.select().from(businessProfile).limit(1))[0];
  if (!profileRow) throw new Error("Business profile not configured.");

  const allPersonas = await db
    .select()
    .from(personas)
    .where(eq(personas.active, true));
  if (allPersonas.length === 0)
    throw new Error("No active personas. Add at least one persona first.");

  const goalRow = (
    await db
      .select()
      .from(quarterlyGoals)
      .where(eq(quarterlyGoals.active, true))
      .limit(1)
  )[0];

  const brief = await getOrCreateBrief(isoWeek);

  // 2. Ensure research signals exist for the week (idempotent)
  await runResearch(isoWeek, { skipIfRecent: true });

  const signalRows = await db
    .select()
    .from(researchSignals)
    .where(eq(researchSignals.weekId, brief.id));
  const signalsById = new Map(
    signalRows.map((s) => [s.id, { id: s.id, summary: s.summary, sourceUrl: s.sourceUrl }])
  );

  // 3. Performance digest (may be empty)
  const performanceDigest = await buildPerformanceDigest();

  // 4. Strategy step
  const services = safeJson<Array<{ name: string }>>(
    profileRow.servicesJson,
    []
  ).map((s) => s.name);
  const strategyResp = await callLLMJson<WeekPlan>({
    task: "strategy",
    messages: buildStrategyPrompt({
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
      brief: {
        focus: brief.focus,
        targetSegment: brief.targetSegment,
        notes: brief.notes,
      },
      personas: allPersonas.map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        voiceProfileMd: p.voiceProfileMd,
        platforms: safeJson<string[]>(p.platformsJson, []),
        cadence: safeJson<Record<string, number>>(p.cadenceJson, {}),
      })),
      signals: signalRows.map((s) => ({
        id: s.id,
        summary: s.summary,
        sourceUrl: s.sourceUrl,
        kind: s.kind,
      })),
      performancePatterns: performanceDigest,
      isoWeek,
    }),
    maxTokens: 3500,
  });
  const weekPlan = strategyResp.content;

  // Persist plan snapshot on the brief
  await db
    .update(weeklyBriefs)
    .set({ weekPlanJson: JSON.stringify(weekPlan) })
    .where(eq(weeklyBriefs.id, brief.id));

  // 5. Wipe existing draft posts for this week so re-runs are idempotent
  // (keep posted/logged ones — only delete drafts.)
  await db
    .delete(postsTable)
    .where(
      and(eq(postsTable.weekId, brief.id), eq(postsTable.status, "draft"))
    );

  // 6. Per-slot generation (sequential to avoid rate-limits; each step is JSON-mode chained)
  const personaById = new Map(allPersonas.map((p) => [p.id, p]));
  let postsCreated = 0;
  for (const slot of weekPlan.slots ?? []) {
    const persona = personaById.get(slot.persona_id);
    if (!persona) {
      console.warn("Skipping slot with unknown persona_id", slot.persona_id);
      continue;
    }
    // Backfill scheduled_for if model returned something unparseable
    if (!slot.scheduled_for || isNaN(Date.parse(slot.scheduled_for))) {
      slot.scheduled_for = isoDateInWeek(isoWeek, postsCreated % 5, 9);
    }
    try {
      await generateOneSlot(slot, {
        weekTheme: weekPlan.week_theme,
        profileVoice: profileRow.voiceGlobal,
        persona,
        signalsById,
        topPerformers: performanceDigest,
        goalObjective: goalRow?.objective,
        weekId: brief.id,
      });
      postsCreated++;
    } catch (err) {
      console.error("Slot generation failed:", (err as Error).message);
    }
  }

  return {
    weekId: brief.id,
    isoWeek,
    postsCreated,
    signalsFetched: signalRows.length,
  };
}

export async function regeneratePost(postId: number): Promise<{ postId: number }> {
  const post = (
    await db.select().from(postsTable).where(eq(postsTable.id, postId)).limit(1)
  )[0];
  if (!post) throw new Error(`Post ${postId} not found.`);

  const brief = (
    await db
      .select()
      .from(weeklyBriefs)
      .where(eq(weeklyBriefs.id, post.weekId))
      .limit(1)
  )[0];
  if (!brief) throw new Error("Weekly brief missing.");

  const weekPlan = safeJson<WeekPlan>(brief.weekPlanJson, {
    week_theme: "",
    reasoning: "",
    slots: [],
  });

  const slot = (weekPlan.slots ?? []).find(
    (s) =>
      s.persona_id === post.personaId &&
      s.platform === post.platform &&
      s.scheduled_for === post.scheduledFor
  ) ??
    // Fallback: synthesize a slot from the existing post
    ({
      persona_id: post.personaId,
      platform: post.platform as "x" | "linkedin",
      scheduled_for: post.scheduledFor,
      theme: weekPlan.week_theme || post.hook.slice(0, 60),
      hook_angle: post.hook,
      why_this_slot: "regenerated",
      signal_ids: [],
    } as SlotPlan);

  const persona = (
    await db.select().from(personas).where(eq(personas.id, post.personaId)).limit(1)
  )[0];
  if (!persona) throw new Error("Persona missing.");

  const profileRow = (await db.select().from(businessProfile).limit(1))[0]!;
  const goalRow = (
    await db
      .select()
      .from(quarterlyGoals)
      .where(eq(quarterlyGoals.active, true))
      .limit(1)
  )[0];

  const signalRows = await db
    .select()
    .from(researchSignals)
    .where(eq(researchSignals.weekId, brief.id));
  const signalsById = new Map(
    signalRows.map((s) => [s.id, { id: s.id, summary: s.summary, sourceUrl: s.sourceUrl }])
  );

  const slotSignals = (slot.signal_ids ?? [])
    .map((id) => signalsById.get(id))
    .filter((s): s is { id: number; summary: string; sourceUrl: string } => !!s);

  const writerResp = await callLLMJson<WriterOutput>({
    task: "write",
    messages: buildWriterPrompt({
      persona: {
        name: persona.name,
        role: persona.role,
        voiceProfileMd: persona.voiceProfileMd,
        dos: persona.dos,
        donts: persona.donts,
        samplePhrases: persona.samplePhrases,
      },
      brandVoiceGlobal: profileRow.voiceGlobal,
      platform: slot.platform,
      theme: slot.theme,
      hookAngle: slot.hook_angle,
      weekTheme: weekPlan.week_theme,
      signals: slotSignals,
    }),
    maxTokens: 1200,
  });
  const draft = writerResp.content;

  let altHooks: HookCriticOutput["alt_hooks"] = [];
  try {
    const critic = await callLLMJson<HookCriticOutput>({
      task: "hook",
      messages: buildHookCriticPrompt({
        platform: slot.platform,
        currentHook: draft.hook,
        body: draft.body,
        personaName: persona.name,
        voiceProfileMd: persona.voiceProfileMd,
        dos: persona.dos,
        donts: persona.donts,
      }),
      maxTokens: 500,
    });
    altHooks = critic.content.alt_hooks ?? [];
  } catch {}

  let polished: PolishOutput = {
    hook: draft.hook,
    body: draft.body,
    hashtags: draft.hashtags ?? [],
  };
  try {
    polished = (
      await callLLMJson<PolishOutput>({
        task: "polish",
        messages: buildPolishPrompt({
          platform: slot.platform,
          hook: draft.hook,
          body: draft.body,
          hashtags: draft.hashtags ?? [],
          donts: persona.donts,
        }),
        maxTokens: 700,
      })
    ).content;
  } catch {}

  await db
    .update(postsTable)
    .set({
      hook: polished.hook,
      body: polished.body,
      hashtagsJson: JSON.stringify(polished.hashtags),
      imagePrompt: draft.image_prompt ?? "",
      altHooksJson: JSON.stringify(altHooks),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(postsTable.id, post.id));

  // Refresh citations
  await db.delete(rationaleCitations).where(eq(rationaleCitations.postId, post.id));
  try {
    const rationaleResp = await callLLMJson<RationaleOutput>({
      task: "rationale",
      messages: buildRationalePrompt({
        platform: slot.platform,
        scheduledFor: slot.scheduled_for,
        hook: polished.hook,
        body: polished.body,
        weekTheme: weekPlan.week_theme,
        slotTheme: slot.theme,
        hookAngle: slot.hook_angle,
        whyThisSlot: slot.why_this_slot,
        personaName: persona.name,
        signalIds: slot.signal_ids ?? [],
        signals: slotSignals,
        goalObjective: goalRow?.objective,
      }),
      maxTokens: 900,
    });
    const r = rationaleResp.content;
    await db
      .update(postsTable)
      .set({
        rationaleJson: JSON.stringify({
          hookStrategy: r.hookStrategy,
          audience: r.audience,
          slotReasoning: r.slotReasoning,
          viralityLever: r.viralityLever,
          expectedOutcome: r.expectedOutcome,
        }),
      })
      .where(eq(postsTable.id, post.id));
    if (Array.isArray(r.citations) && r.citations.length > 0) {
      await db.insert(rationaleCitations).values(
        r.citations.map((c) => ({
          postId: post.id,
          claimKey: c.claim_key,
          claim: c.claim,
          sourceKind: c.source_kind,
          sourceId: c.source_id,
        }))
      );
    }
  } catch {}

  return { postId: post.id };
}
