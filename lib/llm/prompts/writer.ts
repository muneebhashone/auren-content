import type { ChatMessage } from "../types";
import type { ContentType } from "./strategy";
import {
  buildRegister,
  describeBannedPatterns,
  describeBannedVocab,
  describeRegister,
} from "../../generation/humanize";

export interface WriterInput {
  persona: {
    name: string;
    role: string;
    voiceProfileMd: string;
    dos: string;
    donts: string;
    samplePhrases: string;
    // 0-100. Controls humanization register (vocabulary, sentence shape,
    // contractions, slang). See lib/generation/humanize.ts.
    casualness: number;
  };
  brandVoiceGlobal: string;
  platform: "x" | "linkedin" | "reddit";
  theme: string;
  hookAngle: string;
  weekTheme: string;
  signals: Array<{ id: number; summary: string; sourceUrl: string }>;
  topPerformers?: string; // condensed examples of what worked
  // Reddit-only: target subreddit (e.g. "r/SaaS"). Ignored for other platforms.
  subreddit?: string;
  contentType: ContentType;
  // Source material for story / opinion slots, when one was selected.
  storyBankEntry?: {
    kind: "story" | "hot_take";
    title: string;
    body: string;
    tags: string[];
  } | null;
}

export interface WriterOutput {
  hook: string;
  body: string;
  hashtags: string[];
  image_prompt: string;
  // Reddit-only: post title. May be omitted on x/linkedin.
  title?: string;
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
- Line breaks are okay; one or two punchy lines beats a paragraph.
- "title" is not used on X. Leave it as an empty string.`
      : input.platform === "linkedin"
        ? `Platform: LinkedIn. Hard rules:
- Body 600-1400 characters. Multi-paragraph okay.
- 0-3 hashtags, placed at the end. Only relevant ones.
- Open with the hook on its own line. Use line breaks aggressively. LinkedIn rewards scannable posts.
- No "agree?" / "thoughts?" filler endings.
- "title" is not used on LinkedIn. Leave it as an empty string.`
        : `Platform: Reddit${input.subreddit ? ` (target subreddit: ${input.subreddit})` : ""}. Hard rules:
- "title" is REQUIRED and is the most important field. 1-300 characters. The title is what users see in the feed. It must be informative and specific, NOT clickbait, NOT a LinkedIn hook. Reddit titles work like a tldr or a question, not like a tweet.
- "hook" should mirror "title" (Reddit doesn't have a separate hook concept). Set hook = title.
- Body (selftext) 500-10000 characters. Use plain prose with paragraph breaks. Allowed structural markdown: numbered or "-" bullet lists when actually listing things, "> " blockquotes when quoting. NO inline emphasis markdown. Do NOT use **bold**, *italics*, __underline__, or backtick \`code\` styling. Reddit posts read as plain text; asterisks left in the output look like noise. Emphasize with sentence structure, not formatting.
- 0 hashtags. Hashtags are not a thing on Reddit. Always return an empty array.
- Write as a community member of ${input.subreddit || "the target subreddit"}, NOT as a brand or marketer. First-person, conversational, technical when warranted. If you wouldn't post it from a personal account, don't post it.
- NO self-promotion, NO "we built", NO product pitches, NO calls to action like "DM me" or "check out". Most subreddits ban this on sight.
- NO "Hot take:", NO "Unpopular opinion:", NO "Most people think…". These read as karma-farming and get downvoted.
- NO emoji-as-decoration. NO engagement-bait closers ("thoughts?", "agree?", "what do you think?"). A post that earns replies does so by being genuinely interesting.
- It's fine to ask a real question, share a genuine experience, or describe a specific problem you ran into. That's the native shape of Reddit posts.
- Image prompts are rarely useful on text-post subreddits; only generate one if the post is clearly visual. Prefer 4:5 (1024x1280 px) or 1:1 (1024x1024 px) when used.`;

  const contentTypeRules =
    input.contentType === "research"
      ? `Content type: research. Lean on the supplied signals. Concrete numbers, named companies, dated events. Numbers must come from a signal or be hedged ("around", "roughly").`
      : input.contentType === "story"
        ? `Content type: story. First-person, scene-like anecdote. Reuse the SUBSTANCE of the source-material story below, but rewrite it in the persona's voice and tighten it for the platform. Do NOT quote the source verbatim. Concrete specifics (a name, a number, a moment) outperform abstractions. No moral-of-the-story closer; trust the reader to draw the lesson.`
        : input.contentType === "fun"
          ? `Content type: fun. One observation, one twist. Light and relatable, in the persona's natural voice. No "thoughts?" closer. No manufactured relatability ("we've all been there..."). NO jokes that punch down at people or groups; punch at situations and absurdities, not at humans.`
          : `Content type: opinion. Take a clear contrarian stance and defend it in 1-3 sentences (or up to a paragraph on LinkedIn). Anger about PRACTICES is fine and earns impressions.

HARD GUARDRAILS for opinion content:
- MUST NOT mention politics, religion, or ethics-as-identity.
- MUST NOT reference protected groups (race, gender, sexuality, nationality, disability, etc.).
- MUST NOT name a specific individual to attack.
- MUST NOT use slurs of any kind.
- MUST stay inside the global brand pillars and never violate the anti-goals.

What you SHOULD do:
- Punch up at processes, frameworks, hype cycles, and industry/business-culture practices: AI hype, agency cliches, hiring rituals, retainer pricing, hustle culture, VC theater, framework worship, etc.
- Be specific about WHAT you're rejecting and WHY. Vague contrarianism is karma-farming.

Reddit + opinion: rewrite as a specific real-sounding frustration grounded in doing the work; NEVER use "Hot take:" or "Unpopular opinion:" framing (already banned in platform rules). If the source is a hot_take from the story bank, translate it into "here's what I keep running into on the ground" rather than an op-ed.`;

  const system = `You write social posts in the EXACT voice of a specific persona. You do NOT default to LinkedIn-platitude voice or generic hustle-bro voice. You write what THIS person would actually post.

Return ONLY a JSON object:
{
  "hook": "<the opening line, the strongest single sentence; for Reddit, set hook = title>",
  "title": "<Reddit post title; empty string for x/linkedin>",
  "body": "<the rest of the post, EXCLUDING the hook>",
  "hashtags": ["#tag", ...],
  "image_prompt": "<detailed gpt-image-2 prompt for an image generator, or empty string if no image is needed>",
  "used_signal_ids": [<signal id>, ...]
}

${platformRules}

Content type rules
${contentTypeRules}

General rules:
- Voice fidelity beats cleverness. If the persona's voice is dry and direct, do not get cute.
- If the persona's "donts" forbid something, you NEVER do it.
- Hooks should make a stranger stop scrolling: specifics, contrarian takes, real numbers, or named tradeoffs. (For Reddit, the title plays this role, but it must read like a community member wrote it, not a marketer.)
- Do not invent statistics. If you cite a number, it must come from a signal in the input or be hedged ("around", "roughly").
- used_signal_ids must list any signal you actually drew on. Empty array if none.
- When image_prompt is useful, write it as a detailed gpt-image-2 prompt, not a short caption. Include the intended use as a social post image, visual medium or style, subject, setting/background, composition/framing, lighting/mood, color palette, key details, and explicit constraints such as "no watermark" and "no extra text" unless the post needs text in the image.
- Every non-empty image_prompt must explicitly include both an aspect ratio and pixel size. Prefer "Aspect ratio: 4:5. Size: 1024x1280 px" for LinkedIn feed posts and "Aspect ratio: 16:9. Size: 1536x864 px" for X posts unless the post clearly needs square framing. The size must be valid for gpt-image-2: both edges are multiples of 16, under 3840 px, within a 3:1 long-to-short edge ratio, and suitable for a polished social image.
- NEVER use em dashes (—, U+2014) or en dashes (–, U+2013) anywhere in the output. This is a hard rule. Before returning, scan every field for these characters and replace each one with a period, comma, colon, semicolon, or line break. Only the ASCII hyphen-minus (-, U+002D) is allowed, and only inside compound words. If you are tempted to use an em dash, you are wrong; rewrite the sentence.
- NEVER include literal markdown emphasis characters in body text: no \`**\`, no surrounding \`*\`, no \`__\`, no backticks. These render as raw symbols on most surfaces and look like a leak from your scratchpad. Use word choice and sentence structure to emphasize, not formatting.

Sound human (this is the difference between a post that lands and one that gets dismissed as AI):
${describeBannedVocab()}

${describeBannedPatterns()}

${describeRegister(buildRegister(input.persona.casualness, input.platform))}

When in doubt, write the way the persona's voice profile and voice anchor below would write. Match THEIR cadence, not a generic "good writing" cadence.`;

  const signalsText = input.signals.length
    ? input.signals
        .map((s) => `- id=${s.id} ${s.summary} (${s.sourceUrl})`)
        .join("\n")
    : "(no specific signals)";

  const sourceMaterialBlock = input.storyBankEntry
    ? `\nSource material (rewrite in your voice, do NOT quote verbatim):
[${input.storyBankEntry.kind}] ${input.storyBankEntry.title}
${input.storyBankEntry.body}\n`
    : "";

  const user = `Week theme: ${input.weekTheme}
This post's theme: ${input.theme}
Hook angle (the strategist's recommended angle, not yet a hook): ${input.hookAngle}
Content type: ${input.contentType}
${sourceMaterialBlock}
Persona
- Name: ${input.persona.name}
- Role: ${input.persona.role}
- Voice profile:
${input.persona.voiceProfileMd}
- DOs: ${input.persona.dos}
- DON'Ts: ${input.persona.donts}
- Voice anchor (match this cadence and word choice closely; this is the strongest signal of how this person actually writes):
${input.persona.samplePhrases}

Global brand voice (lower priority than persona voice):
${input.brandVoiceGlobal}

Available signals you may draw on (cite ids in used_signal_ids):
${signalsText}

${input.topPerformers ? `Past posts that worked well in similar style. Match this energy:\n${input.topPerformers}\n` : ""}
Write the post now. JSON only.`;

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}
