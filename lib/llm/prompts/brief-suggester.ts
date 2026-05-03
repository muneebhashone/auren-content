import type { ChatMessage } from "../openrouter";

export interface BriefSuggesterInput {
  isoWeek: string;
  region: string;
  icp: string;
  services: string[];
  brandPillars: string;
  antiGoals: string;
  voiceGlobal: string;
  activeGoal: { objective: string; narrative: string; successMetrics: string } | null;
  recentBriefs: Array<{ isoWeek: string; focus: string }>; // last 4 briefs to avoid repetition
  recentPosts: Array<{
    persona: string;
    platform: string;
    hook: string;
    createdAt: string;
  }>; // up to last 20 posts
  signals: Array<{ id: number; summary: string; kind: string; sourceUrl: string }>;
  performanceDigest: string; // may be empty
  personasSummary: Array<{ name: string; role: string; cadence: Record<string, number> }>;
}

export interface BriefSuggesterOutput {
  focus: string;
  target_segment: string;
  notes: string;
  reasoning: string;
  alt_angles: Array<{ angle: string; why: string; segment: string }>;
}

export function buildBriefSuggesterPrompt(
  input: BriefSuggesterInput
): ChatMessage[] {
  const system = `You are an opinionated content strategist embedded in an in-house team. You don't ask the user what they want this week — you tell them what they should do this week and why.

Return ONLY a JSON object:
{
  "focus": "<the single sharpest weekly focus, 1 short sentence — the angle the entire week should rally around>",
  "target_segment": "<who specifically this week is aimed at — 1 sentence, named buyer / role / situation>",
  "notes": "<3-6 short bullet-style lines (use \\n between them) — concrete hooks to pursue, stories to tell, things to avoid this week. Each line ~80 chars max>",
  "reasoning": "<2-3 sentences explaining why this focus, grounded in the active goal + what was already covered + signals + past performance>",
  "alt_angles": [
    { "angle": "<alternative weekly focus>", "why": "<one-sentence rationale>", "segment": "<who this would target>" },
    ... 2 to 3 alt angles total
  ]
}

Hard rules:
- DO NOT repeat a focus that was used in any of the recent briefs (verbatim or near-verbatim). If the recent briefs already covered angle X, surface a different angle.
- The focus MUST ladder up to the active quarterly goal. State a tactical direction, not a vague theme.
- The notes section is for the writer to draw from — name specific hooks, stories, or data points (e.g. "lead with a real client constraint we hit Tuesday", "use the bun + drizzle migration win").
- alt_angles must each be meaningfully different from the chosen focus AND from each other.
- Avoid the brand's anti-goals.
- If past performance shows what's working, lean into that pattern — say so explicitly in reasoning.
- Be concrete. "Talk about AI" is bad. "Show how we cut a client's onboarding from 11 days to 14 hours using a single agentic workflow" is good.`;

  const goalLine = input.activeGoal
    ? `Quarterly objective: ${input.activeGoal.objective}\nNarrative: ${input.activeGoal.narrative}\nSuccess metrics: ${input.activeGoal.successMetrics}`
    : "(no active quarterly goal — recommend one in your reasoning)";

  const recentBriefsText = input.recentBriefs.length
    ? input.recentBriefs.map((b) => `- ${b.isoWeek}: ${b.focus || "(empty)"}`).join("\n")
    : "(no prior briefs)";

  const recentPostsText = input.recentPosts.length
    ? input.recentPosts
        .slice(0, 20)
        .map(
          (p) =>
            `- [${p.platform}] ${p.persona}: ${p.hook.slice(0, 100)}${p.hook.length > 100 ? "…" : ""}`
        )
        .join("\n")
    : "(no posts yet)";

  const signalsText = input.signals.length
    ? input.signals
        .slice(0, 12)
        .map(
          (s) =>
            `- [${s.kind}] ${s.summary}${s.sourceUrl ? " (" + s.sourceUrl + ")" : ""}`
        )
        .join("\n")
    : "(no signals — work from brand context only)";

  const personasText = input.personasSummary
    .map(
      (p) =>
        `- ${p.name} (${p.role}) — cadence ${JSON.stringify(p.cadence)}`
    )
    .join("\n");

  const user = `Week to plan: ${input.isoWeek}

BUSINESS
- Region: ${input.region}
- ICP: ${input.icp}
- Services: ${input.services.join(", ")}
- Brand pillars: ${input.brandPillars}
- Anti-goals: ${input.antiGoals}
- Global voice: ${input.voiceGlobal}

ACTIVE GOAL
${goalLine}

PERSONAS WHO WILL POST
${personasText}

RECENT BRIEFS (do not repeat these focuses)
${recentBriefsText}

RECENT POSTS (last ~20 — read what's already been said)
${recentPostsText}

CURRENT SIGNALS (live trends/competitor moves/news)
${signalsText}

PERFORMANCE PATTERNS (what is working)
${input.performanceDigest || "(no performance data yet)"}

Return the JSON brief suggestion. Be specific. Be opinionated.`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
