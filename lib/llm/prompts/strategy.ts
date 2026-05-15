import type { ChatMessage } from "../types";

export type ContentType = "research" | "story" | "fun" | "opinion";

export interface StoryBankRef {
  id: number;
  kind: "story" | "hot_take";
  title: string;
  body: string;
  tags: string[];
  personaId: number | null;
}

export interface StrategyInput {
  region: string;
  icp: string;
  services: string[];
  brandPillars: string;
  antiGoals: string;
  voiceGlobal: string;
  activeGoal: { objective: string; narrative: string; successMetrics: string } | null;
  brief: { focus: string; targetSegment: string; notes: string };
  personas: Array<{
    id: number;
    name: string;
    role: string;
    voiceProfileMd: string;
    platforms: string[];
    cadence: Record<string, number>;
    subreddits?: string[];
  }>;
  signals: Array<{ id: number; summary: string; sourceUrl: string; kind: string }>;
  performancePatterns: string; // free-text digest of what worked / didn't, may be empty
  isoWeek: string;
  // Absolute slot-count targets per content type (already converted from %)
  contentMix: { research: number; story: number; fun: number; opinion: number };
  // Curated story bank entries available for story / opinion slots.
  storyBank: StoryBankRef[];
}

export interface SlotPlan {
  persona_id: number;
  platform: "x" | "linkedin" | "reddit";
  scheduled_for: string; // ISO datetime within the iso_week
  content_type: ContentType;
  // Required for `story` slots; preferred for `opinion` when a hot_take matches.
  // Null/omitted otherwise.
  story_bank_id?: number | null;
  theme: string;
  hook_angle: string;
  why_this_slot: string; // brief reasoning for day/time choice
  signal_ids: number[]; // citations to research_signals informing this slot
  // Reddit-only: target subreddit chosen from the persona's allowed list.
  subreddit?: string;
}

export interface WeekPlan {
  week_theme: string;
  reasoning: string;
  slots: SlotPlan[];
}

export function buildStrategyPrompt(input: StrategyInput): ChatMessage[] {
  const system = `You are a senior B2B content strategist. You produce a tight weekly plan that ladders up to a quarterly objective AND mixes four content types so the feed engages, not just informs.

Return ONLY a JSON object of this exact shape:
{
  "week_theme": "<one sentence>",
  "reasoning": "<2-4 sentences explaining the angle and the type mix>",
  "slots": [
    {
      "persona_id": <number>,
      "platform": "x" | "linkedin" | "reddit",
      "subreddit": "<r/Name. REQUIRED when platform is reddit, must be from the persona's allowed subreddits list; omit otherwise>",
      "scheduled_for": "<ISO 8601 datetime within the given week>",
      "content_type": "research" | "story" | "fun" | "opinion",
      "story_bank_id": <number | null. REQUIRED for content_type='story'; preferred for 'opinion' when a hot_take matches; null otherwise>,
      "theme": "<topic for this single post>",
      "hook_angle": "<the specific angle, not yet the hook itself>",
      "why_this_slot": "<one sentence: why this day/time/platform/persona/content_type>",
      "signal_ids": [<id>, ...]
    },
    ...
  ]
}

Hard rules:
- Total slots MUST exactly equal the sum of each persona's per-platform cadence.
- Content-type quotas (HARD): the slots array MUST contain exactly the per-type counts given in the user message. Distribute types across personas, platforms, and days. Do not pile all opinion or all story slots on one day.
- Distribute scheduled_for across the week. Use weekday business hours in the persona's region. Avoid weekends unless a persona's cadence requires it.
- LinkedIn slots tend to perform Tue to Thu 8-10am or 12-1pm local. X slots can spread; high-engagement windows are 8-10am and 4-7pm weekdays.
- Reddit slots: peak engagement is weekday mornings (6-9am US Eastern for US-heavy subs); avoid late nights. Choose a subreddit from the persona's allowed list. Match the post's angle to the subreddit's culture (technical subs want technical posts; business subs want operator stories).
- signal_ids: REQUIRED (>=1) for content_type='research' when signals are provided; OPTIONAL for story/fun/opinion (use [] when none applies). Opinion slots MAY cite a signal as a contrarian springboard.
- story_bank_id: REQUIRED for content_type='story'; STRONGLY PREFERRED for content_type='opinion' when a hot_take entry matches the angle. Match by tag overlap with the slot theme. A persona-tagged entry (personaId is set) can ONLY be used by that persona; global entries (personaId null) are usable by anyone. Never assign a story to a slot whose persona_id differs from the entry's personaId.
- If the story bank is empty or no relevant entry exists for an opinion slot, use story_bank_id=null and lean on the persona's voice.
- Themes within the week must be varied (different angles), but all reinforce the week_theme and the active quarterly objective.
- Avoid anti-goals. Stay inside brand pillars.
- For Reddit slots, the angle MUST be community-appropriate (not promotional). Reddit punishes brand-speak.

Per-content-type guidance:
- research: current trend / news / competitor move from this week's signals. Concrete numbers and named companies. The default informative beat.
- story: first-person, scene-like anecdote drawn from the story bank entry. Specific moments, names, and stakes. Reader should feel "I've been there." No moral-of-the-story closer.
- fun: light, observational, relatable. One sharp observation, one twist. Don't manufacture relatability and don't punch down at people or groups.
- opinion: hard-hitting contrarian take on industry topics or adjacent business/work-culture practices (frameworks, AI hype, hiring, agency cliches, hustle culture, VC, retainers, remote work). Anger about PRACTICES is fine and earns impressions. HARD GUARDRAILS: NO politics, NO religion, NO ethics-as-identity, NO protected-group references, NO naming individuals to attack, NO slurs. Punch up at processes, not people. Must stay inside brand pillars and outside anti-goals.

Reddit + opinion combo: AVOID unless the persona's voice is already a known contrarian community member. If used, frame as "specific frustration from doing the work", never as an industry hot take. Reddit downvotes brand-style takes.`;

  const personaLines = input.personas
    .map(
      (p) => {
        const subs = p.subreddits && p.subreddits.length
          ? `, subreddits: ${p.subreddits.join(", ")}`
          : "";
        return `- id=${p.id} ${p.name} (${p.role}) | platforms: ${p.platforms.join(",")}, cadence: ${JSON.stringify(p.cadence)}${subs}\n  voice: ${p.voiceProfileMd.slice(0, 240)}`;
      }
    )
    .join("\n");

  const signalLines = input.signals.length
    ? input.signals
        .map((s) => `- id=${s.id} [${s.kind}] ${s.summary} (${s.sourceUrl})`)
        .join("\n")
    : "(no signals; rely on brand context only)";

  const goalLine = input.activeGoal
    ? `Quarterly objective: ${input.activeGoal.objective}\nNarrative: ${input.activeGoal.narrative}\nSuccess metrics: ${input.activeGoal.successMetrics}`
    : "(no active quarterly goal)";

  const mixLines =
    `- research: ${input.contentMix.research}\n` +
    `- story: ${input.contentMix.story}\n` +
    `- fun: ${input.contentMix.fun}\n` +
    `- opinion: ${input.contentMix.opinion}`;

  const storyBankLines = input.storyBank.length
    ? input.storyBank
        .map((e) => {
          const persona =
            e.personaId !== null
              ? `persona=${e.personaId}`
              : "persona=global";
          const tags = e.tags.length ? e.tags.join(",") : "(no tags)";
          const body = e.body.replace(/\s+/g, " ").slice(0, 240);
          return `- id=${e.id} [${e.kind}] (${persona}) tags=${tags} | ${e.title}: ${body}`;
        })
        .join("\n")
    : "(story bank is empty; story slots will lean on persona voice alone, opinion slots may use a signal as springboard)";

  const user = `ISO week: ${input.isoWeek}

Business profile
- Region: ${input.region}
- ICP: ${input.icp}
- Services: ${input.services.join(", ")}
- Brand pillars: ${input.brandPillars}
- Anti-goals: ${input.antiGoals}
- Global voice: ${input.voiceGlobal}

${goalLine}

Weekly brief
- Focus: ${input.brief.focus}
- Target segment: ${input.brief.targetSegment}
- Notes: ${input.brief.notes}

Personas (and their cadence; slot count is the sum of these)
${personaLines}

Content-type targets (slots array MUST contain exactly these counts)
${mixLines}

Story bank (use story_bank_id; respect persona scoping)
${storyBankLines}

Research signals available for citation
${signalLines}

Performance patterns from past posts (may be empty)
${input.performancePatterns || "(none yet)"}

Produce the JSON week plan.`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
