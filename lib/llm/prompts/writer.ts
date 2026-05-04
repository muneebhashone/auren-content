import type { ChatMessage } from "../openrouter";

export interface WriterInput {
  persona: {
    name: string;
    role: string;
    voiceProfileMd: string;
    dos: string;
    donts: string;
    samplePhrases: string;
  };
  brandVoiceGlobal: string;
  platform: "x" | "linkedin";
  theme: string;
  hookAngle: string;
  weekTheme: string;
  signals: Array<{ id: number; summary: string; sourceUrl: string }>;
  topPerformers?: string; // condensed examples of what worked
}

export interface WriterOutput {
  hook: string;
  body: string;
  hashtags: string[];
  image_prompt: string;
  // refs back to signal ids the writer leaned on
  used_signal_ids: number[];
}

export function buildWriterPrompt(input: WriterInput): ChatMessage[] {
  const platformRules =
    input.platform === "x"
      ? `Platform: X (Twitter). Hard rules:
- Body must be <= 270 characters total (leave room for the hook line).
- 0-2 hashtags max, only if they're industry-real (not motivational fluff).
- No "thread 🧵" framing unless the angle truly needs a thread.
- Line breaks are okay; one or two punchy lines beats a paragraph.`
      : `Platform: LinkedIn. Hard rules:
- Body 600-1400 characters. Multi-paragraph okay.
- 0-3 hashtags, placed at the end. Only relevant ones.
- Open with the hook on its own line. Use line breaks aggressively — LinkedIn rewards scannable posts.
- No "agree?" / "thoughts?" filler endings.`;

  const system = `You write social posts in the EXACT voice of a specific persona. You do NOT default to LinkedIn-platitude voice or generic hustle-bro voice. You write what THIS person would actually post.

Return ONLY a JSON object:
{
  "hook": "<the opening line — the strongest single sentence>",
  "body": "<the rest of the post, EXCLUDING the hook>",
  "hashtags": ["#tag", ...],
  "image_prompt": "<detailed gpt-image-2 prompt for an image generator, or empty string if no image is needed>",
  "used_signal_ids": [<signal id>, ...]
}

${platformRules}

General rules:
- Voice fidelity beats cleverness. If the persona's voice is dry and direct, do not get cute.
- If the persona's "donts" forbid something, you NEVER do it.
- Hooks should make a stranger stop scrolling: specifics, contrarian takes, real numbers, or named tradeoffs.
- Do not invent statistics. If you cite a number, it must come from a signal in the input or be hedged ("around", "roughly").
- used_signal_ids must list any signal you actually drew on. Empty array if none.
- When image_prompt is useful, write it as a detailed gpt-image-2 prompt, not a short caption. Include the intended use as a social post image, visual medium or style, subject, setting/background, composition/framing, lighting/mood, color palette, key details, and explicit constraints such as "no watermark" and "no extra text" unless the post needs text in the image.
- Every non-empty image_prompt must explicitly include both an aspect ratio and pixel size. Prefer "Aspect ratio: 4:5. Size: 1024x1280 px" for LinkedIn feed posts and "Aspect ratio: 16:9. Size: 1536x864 px" for X posts unless the post clearly needs square framing. The size must be valid for gpt-image-2: both edges are multiples of 16, under 3840 px, within a 3:1 long-to-short edge ratio, and suitable for a polished social image.
- NEVER use em dashes (—) or en dashes (–) anywhere in the output. Use a period, comma, colon, or line break instead. Hyphens (-) inside compound words are fine.`;

  const signalsText = input.signals.length
    ? input.signals
        .map((s) => `- id=${s.id} ${s.summary} (${s.sourceUrl})`)
        .join("\n")
    : "(no specific signals)";

  const user = `Week theme: ${input.weekTheme}
This post's theme: ${input.theme}
Hook angle (the strategist's recommended angle, not yet a hook): ${input.hookAngle}

Persona
- Name: ${input.persona.name}
- Role: ${input.persona.role}
- Voice profile:
${input.persona.voiceProfileMd}
- DOs: ${input.persona.dos}
- DON'Ts: ${input.persona.donts}
- Sample phrases / cadences: ${input.persona.samplePhrases}

Global brand voice (lower priority than persona voice):
${input.brandVoiceGlobal}

Available signals you may draw on (cite ids in used_signal_ids):
${signalsText}

${input.topPerformers ? `Past posts that worked well in similar style — match this energy:\n${input.topPerformers}\n` : ""}
Write the post now. JSON only.`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
