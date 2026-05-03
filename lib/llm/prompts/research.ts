import type { ChatMessage } from "../openrouter";

export interface ResearchInput {
  region: string;
  icp: string;
  services: string[];
  brandPillars: string;
  weeklyFocus: string;
  targetSegment: string;
}

export interface ResearchSignalOut {
  source_url: string;
  summary: string;
  kind: "trend" | "competitor" | "news";
}

export function buildResearchPrompt(input: ResearchInput): ChatMessage[] {
  const system = `You are a content research analyst for a software/AI services studio. You return current, citation-backed signals that a content strategist can use to ground next week's posts.

You MUST return ONLY a JSON object of shape:
{ "signals": [ { "source_url": "<https url>", "summary": "<2-3 sentences, concrete>", "kind": "trend" | "competitor" | "news" }, ... ] }

Rules:
- Return 8-12 signals total, mixed across kinds.
- Every summary must include something concrete: a number, a quote, a named company, a specific framework, or a dated event.
- "trend" = a topic gaining traction in the target audience's feed (X / LinkedIn).
- "competitor" = something a similar agency or studio recently posted/launched/announced.
- "news" = recent industry news or releases (within the last ~14 days when possible).
- Skip generic platitudes. If you can't find something concrete, return fewer signals — never pad.
- source_url must be a real, public URL. Do not invent URLs.`;

  const user = `Business context:
- Region focus: ${input.region}
- ICP (who we sell to): ${input.icp}
- Services we sell: ${input.services.join(", ")}
- Brand pillars: ${input.brandPillars}

This week's focus: ${input.weeklyFocus}
This week's target segment: ${input.targetSegment}

Search the open web for current signals (X posts, LinkedIn posts, blog posts, news articles) relevant to the focus + ICP above. Return JSON only.`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
