import type { ChatMessage } from "../openrouter";

export interface PolishInput {
  platform: "x" | "linkedin" | "reddit";
  hook: string;
  body: string;
  hashtags: string[];
  donts: string;
  // Reddit-only: post title
  title?: string;
  // Reddit-only: target subreddit (for context only)
  subreddit?: string;
}

export interface PolishOutput {
  hook: string;
  body: string;
  hashtags: string[];
  // Reddit-only: polished title. Empty/omitted on x/linkedin.
  title?: string;
}

export function buildPolishPrompt(input: PolishInput): ChatMessage[] {
  const platformRule =
    input.platform === "x"
      ? "X: hook + body <= ~280 chars; <= 2 hashtags."
      : input.platform === "linkedin"
        ? "LinkedIn: 600-1400 chars; <= 3 hashtags placed at the end."
        : `Reddit${input.subreddit ? ` (${input.subreddit})` : ""}: title <= 300 chars and informative (not clickbait, not a LinkedIn-style hook); body 500-10000 chars; markdown OK; 0 hashtags (strip them all); strip self-promo language ("we built", "DM me", "check out our…"); strip "Hot take:" / "Unpopular opinion:" framings; strip emoji-decoration and engagement-bait closers; keep it readable as something a community member would post.`;

  const system = `You polish drafts to platform constraints WITHOUT changing the voice or message. You only:
- Fix length per platform.
- Fix awkward phrasing or repetition.
- Strip filler ("just", "really", "I think", "in my opinion").
- Strip closings like "thoughts?" / "agree?".
- Trim hashtags per platform (X: <= 2, LinkedIn: <= 3, Reddit: 0).
- Apply the persona's DON'Ts.
- Replace ALL em dashes (—, U+2014) and en dashes (–, U+2013) with a period, comma, colon, semicolon, or line break. Scan every output field character by character before returning. Never let one ship. The only allowed dash character is the ASCII hyphen-minus (-, U+002D), and only inside compound words.
- For Reddit specifically: strip ALL inline emphasis markdown from the body. Remove every \`**\`, surrounding \`*\`, \`__\`, and backtick used for code. Leave the underlying words intact. Bullet lists ("- " or "1. ") and "> " blockquotes can stay if they're structurally meaningful; otherwise convert to plain prose.

Platform rule: ${platformRule}

Return ONLY:
{ "hook": "<polished hook>", "title": "<polished title (Reddit only, empty string otherwise)>", "body": "<polished body>", "hashtags": ["#tag", ...] }

Do NOT rewrite for tone. Do NOT change the substance. Do NOT add new claims.`;

  const user = `Platform: ${input.platform}${input.subreddit ? ` (subreddit: ${input.subreddit})` : ""}
Persona DON'Ts: ${input.donts}
${input.title ? `Title: ${input.title}\n` : ""}
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
