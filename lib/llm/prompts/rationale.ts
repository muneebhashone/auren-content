import type { ChatMessage } from "../openrouter";

export interface RationaleInput {
  platform: "x" | "linkedin" | "reddit";
  scheduledFor: string;
  hook: string;
  body: string;
  weekTheme: string;
  slotTheme: string;
  hookAngle: string;
  whyThisSlot: string;
  personaName: string;
  signalIds: number[];
  signals: Array<{ id: number; summary: string; sourceUrl: string }>;
  topPerformersSummary?: string;
  goalObjective?: string;
}

export interface RationaleClaim {
  claim_key:
    | "hookStrategy"
    | "audience"
    | "slotReasoning"
    | "viralityLever"
    | "expectedOutcome";
  claim: string;
  source_kind: "signal" | "persona" | "performance" | "profile" | "goal" | "brief";
  source_id: number | null;
}

export interface RationaleOutput {
  hookStrategy: string;
  audience: string;
  slotReasoning: string;
  viralityLever: string;
  expectedOutcome: string;
  citations: RationaleClaim[];
}

export function buildRationalePrompt(input: RationaleInput): ChatMessage[] {
  const system = `You explain WHY a finished social post is shaped the way it is. The user reads this to trust (or correct) the strategy. You also produce explicit citations linking each claim back to a source.

Return ONLY:
{
  "hookStrategy": "<one sentence: what kind of hook and why>",
  "audience": "<one sentence: who this is aimed at>",
  "slotReasoning": "<one sentence: why this day/time/platform>",
  "viralityLever": "<one sentence: what makes this stop a scroll>",
  "expectedOutcome": "<one sentence: concrete result we'd hope for, e.g. saves, replies, DMs>",
  "citations": [
    { "claim_key": "<one of: hookStrategy|audience|slotReasoning|viralityLever|expectedOutcome>",
      "claim": "<short reason snippet>",
      "source_kind": "signal" | "persona" | "performance" | "profile" | "goal" | "brief",
      "source_id": <number id of the source, or null if source_kind is 'profile' / 'brief' which are singletons> }
  ]
}

Rules:
- Be specific. "Speaks to founders" is too vague. Name what about the post speaks to founders.
- Every citation must point to something real: a signal_id from the supplied list, the persona, the active goal, etc. Don't invent ids.
- Aim for 3-6 citations total. Do NOT pad.`;

  const signalsText = input.signals.length
    ? input.signals
        .map((s) => `- signal id=${s.id}: ${s.summary} (${s.sourceUrl})`)
        .join("\n")
    : "(none)";

  const user = `Post (${input.platform}, scheduled ${input.scheduledFor}, persona ${input.personaName}):
HOOK: ${input.hook}
BODY: ${input.body}

Strategy context
- Week theme: ${input.weekTheme}
- This slot's theme: ${input.slotTheme}
- Hook angle the strategist recommended: ${input.hookAngle}
- Why this slot: ${input.whyThisSlot}
${input.goalObjective ? `- Active quarterly objective: ${input.goalObjective}\n` : ""}
Signals available for citation
${signalsText}
${input.topPerformersSummary ? `Past-performance digest: ${input.topPerformersSummary}\n` : ""}
Return the JSON rationale with citations now.`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
