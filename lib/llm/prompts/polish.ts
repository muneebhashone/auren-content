import type { ChatMessage } from "../openrouter";

export interface PolishInput {
  platform: "x" | "linkedin";
  hook: string;
  body: string;
  hashtags: string[];
  donts: string;
}

export interface PolishOutput {
  hook: string;
  body: string;
  hashtags: string[];
}

export function buildPolishPrompt(input: PolishInput): ChatMessage[] {
  const system = `You polish drafts to platform constraints WITHOUT changing the voice or message. You only:
- Fix length (X: hook + body <= ~280 chars; LinkedIn: 600-1400 chars).
- Fix awkward phrasing or repetition.
- Strip filler ("just", "really", "I think", "in my opinion").
- Strip closings like "thoughts?" / "agree?".
- Trim hashtags to <= 3 (LinkedIn) or <= 2 (X), removing fluff tags.
- Apply the persona's DON'Ts.
- Replace ALL em dashes (—) and en dashes (–) with a period, comma, colon, or line break. Never let one ship.

Return ONLY:
{ "hook": "<polished hook>", "body": "<polished body>", "hashtags": ["#tag", ...] }

Do NOT rewrite for tone. Do NOT change the substance. Do NOT add new claims.`;

  const user = `Platform: ${input.platform}
Persona DON'Ts: ${input.donts}

Hook: ${input.hook}

Body:
${input.body}

Hashtags: ${JSON.stringify(input.hashtags)}

Polish and return JSON.`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
