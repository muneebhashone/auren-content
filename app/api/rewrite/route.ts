import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { businessProfile, personas, rewrites } from "@/lib/db/schema";
import { safeJson } from "@/lib/utils";
import { callLLMJson } from "@/lib/llm";
import {
  buildResearchPrompt,
  type ResearchSignalOut,
} from "@/lib/llm/prompts/research";
import {
  buildWriterPrompt,
  type WriterOutput,
  type WriterInput,
} from "@/lib/llm/prompts/writer";
import { sanitizeForPlatform } from "@/lib/generation/text-sanitize";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  dump: z.string().trim().min(1, "dump is empty").max(8000),
  personaId: z.number().int().positive(),
  factCheck: z.boolean().default(false),
});

type Variant = {
  hook: string;
  body: string;
  hashtags: string[];
  title?: string;
};
type VariantKind = "polished" | "faithful";
type Platform = "linkedin" | "x" | "reddit";

export async function POST(req: NextRequest) {
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 400 }
    );
  }

  const { dump, personaId, factCheck } = parsed;

  const [persona] = await db
    .select()
    .from(personas)
    .where(and(eq(personas.id, personaId), eq(personas.active, true)))
    .limit(1);
  if (!persona) {
    return NextResponse.json(
      { error: "Persona not found or inactive" },
      { status: 404 }
    );
  }

  const profile = (await db.select().from(businessProfile).limit(1))[0];
  const brandVoiceGlobal = profile?.voiceGlobal ?? "";

  let signals: Array<{ id: number; summary: string; sourceUrl: string }> = [];
  let signalsForResponse: Array<{ summary: string; sourceUrl: string }> = [];

  if (factCheck && profile) {
    try {
      const services = safeJson<Array<{ name: string }>>(
        profile.servicesJson,
        []
      ).map((s) => s.name);
      const messages = buildResearchPrompt({
        region: profile.region,
        icp: profile.icp,
        services,
        brandPillars: profile.brandPillars,
        weeklyFocus: `Verify and surface supporting evidence (or contradictions) for these claims:\n\n${dump}`,
        targetSegment: persona.role || persona.name,
      });
      const result = await callLLMJson<{ signals: ResearchSignalOut[] }>({
        task: "research",
        messages,
        maxTokens: 2200,
        extraBody: { search_recency_filter: "month" },
      });
      const raw = result.content.signals ?? [];
      signals = raw.map((s, i) => ({
        id: i + 1,
        summary: s.summary,
        sourceUrl: s.source_url ?? "",
      }));
      signalsForResponse = raw
        .filter((s) => !!s.source_url)
        .map((s) => ({ summary: s.summary, sourceUrl: s.source_url }));
    } catch (err) {
      console.warn(
        "[rewrite] grounding failed, continuing without:",
        (err as Error).message
      );
    }
  }

  const theme = dump.length > 300 ? dump.slice(0, 300) + "…" : dump;

  const polishedPersona: WriterInput["persona"] = {
    name: persona.name,
    role: persona.role,
    voiceProfileMd: persona.voiceProfileMd,
    dos: persona.dos,
    donts: persona.donts,
    samplePhrases: persona.samplePhrases,
  };

  const faithfulPersona: WriterInput["persona"] = {
    name: persona.name,
    role: persona.role,
    voiceProfileMd: `TONE-MATCH MODE. Voice anchor = the user's own writing below. Match its TONE (formal/casual, dry/punchy, technical/conversational), REGISTER (vocabulary level, slang, jargon), ENERGY (calm/intense), and POINT OF VIEW. Do NOT impose a persona-style voice on top.

User's own words (the source of truth for tone, intent, and claims):
"""
${dump}
"""

You ARE rewriting this for social. You are NOT pasting it back. The output must read like the user, on a good day, posting to the platform.`,
    dos: `REWRITE the dump into a real social post. Required edits: build a punchy hook line, restructure for scannability, cut redundancy, hit the platform's character limits. Keep the user's vocabulary, claims, viewpoint, and intent intact. Open with the strongest beat from the dump (rephrased if needed for punch, but in the user's register).`,
    donts: `Do NOT just paste the dump back. Do NOT keep the dump's original paragraph structure if it doesn't fit the platform. Do NOT exceed character limits. Do NOT add claims, statistics, framings, or opinions the user didn't include. Do NOT "professionalize" or soften the tone. Do NOT swap the user's vocabulary for the persona's. Do NOT add stock LinkedIn hooks like "Here's the truth", "Most people think", "Hot take". (Persona's original donts also apply: ${persona.donts})`,
    samplePhrases: dump,
  };

  const polishedAngle =
    "Rewrite the user's dump. Keep their angle and claims, but sharpen the hook and tighten the prose into the persona's voice. Make it scroll-stopping for the platform.";
  const faithfulAngleX =
    "TONE-MATCH MODE for X. Preserve the user's tone, intent, and claims. Rewrite (do NOT paste) into a tight X post: punchy hook line + at most one or two follow-up beats. HARD LIMIT: body must be 270 characters or fewer — count and cut. Use the user's vocabulary and viewpoint, not the persona's voice. The hook should hit harder than the dump's opener but in the user's register.";
  const faithfulAngleLinkedIn =
    "TONE-MATCH MODE for LinkedIn. Preserve the user's tone, intent, and claims. Rewrite (do NOT paste) into a scannable LinkedIn post (600-1400 chars body). Build a real hook line in the user's voice, then break the dump's substance into short scannable lines/paragraphs. Use the user's vocabulary and viewpoint, not the persona's voice.";
  const faithfulAngleReddit =
    "TONE-MATCH MODE for Reddit. Preserve the user's tone, intent, and claims. Rewrite (do NOT paste) into a real Reddit post: an informative title (not a clickbait hook) plus a markdown-friendly body. Write as a community member, not a brand. NO hashtags. NO self-promo language. NO 'Hot take:' framings. Use the user's vocabulary and viewpoint.";

  function faithfulAngleFor(platform: Platform): string {
    if (platform === "x") return faithfulAngleX;
    if (platform === "linkedin") return faithfulAngleLinkedIn;
    return faithfulAngleReddit;
  }

  async function writeOne(
    platform: Platform,
    kind: VariantKind
  ): Promise<Variant> {
    const faithfulAngle = faithfulAngleFor(platform);
    const resp = await callLLMJson<WriterOutput>({
      task: "write",
      messages: buildWriterPrompt({
        persona: kind === "polished" ? polishedPersona : faithfulPersona,
        brandVoiceGlobal: kind === "polished" ? brandVoiceGlobal : "",
        platform,
        theme,
        hookAngle: kind === "polished" ? polishedAngle : faithfulAngle,
        weekTheme: "",
        signals,
      }),
      maxTokens: 1200,
    });
    const rawTitle =
      platform === "reddit"
        ? resp.content.title || resp.content.hook
        : undefined;
    const cleanTitle = rawTitle ? sanitizeForPlatform(platform, rawTitle) : undefined;
    const cleanHook = sanitizeForPlatform(platform, resp.content.hook);
    return {
      hook: platform === "reddit" && cleanTitle ? cleanTitle : cleanHook,
      body: sanitizeForPlatform(platform, resp.content.body),
      hashtags: platform === "reddit" ? [] : resp.content.hashtags ?? [],
      title: cleanTitle,
    };
  }

  try {
    const [
      linkedinPolished,
      linkedinFaithful,
      xPolished,
      xFaithful,
      redditPolished,
      redditFaithful,
    ] = await Promise.all([
      writeOne("linkedin", "polished"),
      writeOne("linkedin", "faithful"),
      writeOne("x", "polished"),
      writeOne("x", "faithful"),
      writeOne("reddit", "polished"),
      writeOne("reddit", "faithful"),
    ]);
    const variants = {
      linkedin: { polished: linkedinPolished, faithful: linkedinFaithful },
      x: { polished: xPolished, faithful: xFaithful },
      reddit: { polished: redditPolished, faithful: redditFaithful },
    };
    const [inserted] = await db
      .insert(rewrites)
      .values({
        dump,
        personaId: persona.id,
        personaName: persona.name,
        factCheck,
        variantsJson: JSON.stringify(variants),
        signalsJson: JSON.stringify(signalsForResponse),
      })
      .returning({ id: rewrites.id });
    return NextResponse.json({
      id: inserted.id,
      ...variants,
      signals: signalsForResponse,
    });
  } catch (err) {
    console.error("[rewrite] writer failed", err);
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
