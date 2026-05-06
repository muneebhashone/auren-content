import type { ChatMessage } from "../openrouter";

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
}

export interface SlotPlan {
  persona_id: number;
  platform: "x" | "linkedin" | "reddit";
  scheduled_for: string; // ISO datetime within the iso_week
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
  const system = `You are a senior B2B content strategist. You produce a tight weekly plan that ladders up to a quarterly objective and uses real research signals.

Return ONLY a JSON object of this exact shape:
{
  "week_theme": "<one sentence>",
  "reasoning": "<2-4 sentences explaining the angle>",
  "slots": [
    {
      "persona_id": <number>,
      "platform": "x" | "linkedin" | "reddit",
      "subreddit": "<r/Name. REQUIRED when platform is reddit, must be from the persona's allowed subreddits list; omit otherwise>",
      "scheduled_for": "<ISO 8601 datetime within the given week>",
      "theme": "<topic for this single post>",
      "hook_angle": "<the specific angle, not yet the hook itself>",
      "why_this_slot": "<one sentence: why this day/time/platform/persona/subreddit>",
      "signal_ids": [<id>, ...]
    },
    ...
  ]
}

Hard rules:
- Total slots MUST exactly equal the sum of each persona's per-platform cadence.
- Distribute scheduled_for across the week. Use weekday business hours in the persona's region. Avoid weekends unless a persona's cadence requires it.
- LinkedIn slots tend to perform Tue to Thu 8-10am or 12-1pm local. X slots can spread; high-engagement windows are 8-10am and 4-7pm weekdays.
- Reddit slots: peak engagement is weekday mornings (6-9am US Eastern for US-heavy subs); avoid late nights. Choose a subreddit from the persona's allowed list. Match the post's angle to the subreddit's culture (technical subs want technical posts; business subs want operator stories).
- Each slot MUST cite at least 1 signal_id when signals are provided; cite 2-3 when relevant. Use [] only if no signal applies.
- Themes within the week must be varied (different angles), but all reinforce the week_theme and the active quarterly objective.
- Avoid anti-goals. Stay inside brand pillars.
- For Reddit slots, the angle MUST be community-appropriate (not promotional). Reddit punishes brand-speak.`;

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
