import type { ChatMessage } from "../openrouter";

export interface FeedbackAnalysisInput {
  posts: Array<{
    id: number;
    platform: "x" | "linkedin" | "reddit";
    persona: string;
    hook: string;
    body: string;
    impressions: number;
    likes: number;
    comments: number;
    reposts: number;
    qualitativeNote: string;
  }>;
}

export interface FeedbackAnalysisOutput {
  summary: string;
  what_works: string[];
  what_misses: string[];
  recommendations: string[];
  top_performers: number[]; // post ids
}

export function buildFeedbackAnalysisPrompt(
  input: FeedbackAnalysisInput
): ChatMessage[] {
  const system = `You are a content performance analyst. You read a corpus of past posts with their metrics and qualitative notes, and you find PATTERNS, not just rankings.

Return ONLY:
{
  "summary": "<2-3 sentence high-level pattern>",
  "what_works": ["<concrete pattern>", ...],
  "what_misses": ["<concrete pattern>", ...],
  "recommendations": ["<actionable instruction for next week's prompts>", ...],
  "top_performers": [<post id>, ...]
}

Rules:
- "Engagement" by itself is not a pattern. The pattern is the structural reason: hook style, format, persona-platform fit, posting time, topic angle.
- Be willing to say "not enough data" in the summary if the corpus is small.
- top_performers: at most 5 ids, ranked roughly by qualitative + quantitative impact (qualitative_note "got us a real lead" weighs more than raw likes).`;

  const lines = input.posts
    .map(
      (p) =>
        `id=${p.id} | ${p.platform} | ${p.persona} | imp=${p.impressions} lk=${p.likes} cm=${p.comments} rp=${p.reposts}\nHOOK: ${p.hook}\nBODY: ${p.body.slice(0, 280)}\nNOTE: ${p.qualitativeNote || "(none)"}\n`
    )
    .join("\n---\n");

  const user = `Past posts:\n\n${lines}\n\nReturn the JSON pattern digest.`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
