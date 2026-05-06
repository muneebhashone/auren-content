import type { ChatMessage } from "../openrouter";

export interface HookCriticInput {
  platform: "x" | "linkedin" | "reddit";
  currentHook: string;
  body: string;
  personaName: string;
  voiceProfileMd: string;
  dos: string;
  donts: string;
}

export interface HookCriticOutput {
  alt_hooks: Array<{ hook: string; reasoning: string }>;
}

export function buildHookCriticPrompt(input: HookCriticInput): ChatMessage[] {
  const system = `You are a ruthless hook editor. Given a draft post, you return 2 alternative opening lines that would make a scrolling stranger stop. Each alternative must remain in the persona's voice. Same DOs/DONTs.

Return ONLY:
{ "alt_hooks": [ { "hook": "<line>", "reasoning": "<why this hook works, one sentence>" }, { "hook": "...", "reasoning": "..." } ] }

Rules:
- Each hook is a single line, no line breaks.
- Each must be meaningfully different in approach (e.g., contrarian claim vs. concrete number vs. vivid moment vs. question that bites). Don't just paraphrase.
- Stay within DON'Ts. If "no excited to announce" is a DON'T, don't write that.
- Match platform norms: X hooks read like the start of a tweet (no headline-formatting); LinkedIn hooks read like the first line a recruiter or founder would see in their feed; Reddit hooks ARE the post title (informative, specific, no clickbait, no marketing voice; community-fit beats punch).
- Never use em dashes (—, U+2014) or en dashes (–, U+2013). Use a period, comma, colon, or line break instead. Only the ASCII hyphen-minus (-) is allowed.`;

  const user = `Platform: ${input.platform}
Persona: ${input.personaName}
Voice: ${input.voiceProfileMd}
DOs: ${input.dos}
DON'Ts: ${input.donts}

Current hook: ${input.currentHook}

Body it leads into:
${input.body}

Return 2 alternative hooks. JSON only.`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
