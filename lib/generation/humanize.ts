// Single source of truth for "make this sound like a human wrote it" rules.
// The writer prompt, polish prompt, and post-process detector all read from
// this module so the rules can't drift.

export type Platform = "x" | "linkedin" | "reddit";

// Words/phrases that scream "AI wrote this." Curated short list — long lists
// become noise to the model. Add only when you see a tell escape repeatedly.
export const BANNED_WORDS: readonly string[] = [
  "delve",
  "leverage",
  "robust",
  "seamless",
  "elevate",
  "unlock",
  "harness",
  "realm",
  "landscape",
  "navigate",
  "game-changer",
  "deep dive",
  "double down",
  "moving forward",
  "at the end of the day",
  "it's important to note",
  "in today's fast-paced world",
  "in the ever-evolving",
  "crucial",
  "pivotal",
  "paramount",
  "cutting-edge",
  "revolutionize",
  "transformative",
];

// Structural anti-patterns. Each is paired with a brief description used in
// the prompt so the model knows the SHAPE to avoid, not just the keyword.
export interface BannedPattern {
  name: string;
  regex: RegExp;
  description: string;
}

export const BANNED_PATTERNS: readonly BannedPattern[] = [
  {
    name: "not_just_but",
    regex: /\bnot just\b[^.?!]{1,80}\bbut\b/i,
    description: '"Not just X, but Y" construction',
  },
  {
    name: "heres_the_thing",
    regex: /\bhere's the thing\b\s*[:.]?/i,
    description: '"Here\'s the thing:" opener',
  },
  {
    name: "the_truth_is",
    regex: /\bthe truth is\b\s*[:.]?/i,
    description: '"The truth is:" opener',
  },
  {
    name: "let_me_explain",
    regex: /\blet me explain\b\s*[:.]?/i,
    description: '"Let me explain:" filler',
  },
  {
    name: "lets_dive_in",
    regex: /\blet'?s (dive|jump) in\b/i,
    description: '"Let\'s dive in" filler',
  },
];

// Per-platform sensitivity. Reddit punishes AI-isms hardest; LinkedIn is more
// tolerant of measured tone. The multiplier scales the persona's casualness.
const PLATFORM_MULTIPLIER: Record<Platform, number> = {
  reddit: 1.2,
  x: 1.0,
  linkedin: 0.7,
};

export interface RegisterRules {
  // Effective casualness after platform multiplier (0-100).
  effective: number;
  // How heavily to use contractions: "rare" | "natural" | "heavy".
  contractions: "rare" | "natural" | "heavy";
  // Sentence-fragment permission.
  fragmentsAllowed: boolean;
  // Conjunction-start permission ("And", "But", "So" at sentence start).
  conjunctionStartsAllowed: boolean;
  // Comma splices in casual moods.
  commaSplicesAllowed: boolean;
  // Industry slang / shorthand tolerance.
  slang: "minimal" | "moderate" | "liberal";
  // Target Flesch reading ease floor (higher = simpler).
  fleschTarget: number;
  // Target average sentence length (words).
  avgSentenceLen: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function buildRegister(
  casualness: number,
  platform: Platform
): RegisterRules {
  const effective = clamp(
    Math.round(casualness * PLATFORM_MULTIPLIER[platform]),
    0,
    100
  );

  const contractions: RegisterRules["contractions"] =
    effective >= 70 ? "heavy" : effective >= 35 ? "natural" : "rare";

  const slang: RegisterRules["slang"] =
    effective >= 70 ? "liberal" : effective >= 40 ? "moderate" : "minimal";

  // Below ~30 effective casualness, keep things tight and conventional.
  const fragmentsAllowed = effective >= 30;
  const conjunctionStartsAllowed = effective >= 30;
  const commaSplicesAllowed = effective >= 60;

  // Reading-ease floor: ~50 is "fairly difficult", ~60 is "plain English",
  // ~70 is "fairly easy". Casual platforms should land at 65+.
  const fleschTarget =
    platform === "x"
      ? 60 + Math.round(effective * 0.15)
      : platform === "reddit"
        ? 55 + Math.round(effective * 0.2)
        : 50 + Math.round(effective * 0.15);

  const avgSentenceLen =
    effective >= 70 ? 12 : effective >= 40 ? 16 : 20;

  return {
    effective,
    contractions,
    fragmentsAllowed,
    conjunctionStartsAllowed,
    commaSplicesAllowed,
    slang,
    fleschTarget,
    avgSentenceLen,
  };
}

// Render the register as a prompt block. Concrete instructions, not vibes.
export function describeRegister(r: RegisterRules): string {
  const parts = [
    `Casualness register (effective ${r.effective}/100):`,
    `- Contractions: ${r.contractions === "heavy" ? "use them throughout (don't, won't, it's, you're, that's)" : r.contractions === "natural" ? "use them where they sound natural" : "rare; only when it would be stilted otherwise"}.`,
    `- Sentence fragments: ${r.fragmentsAllowed ? "allowed and encouraged for emphasis. Like this." : "avoid; write complete sentences."}`,
    `- Sentence openings with And/But/So: ${r.conjunctionStartsAllowed ? "allowed when it improves flow." : "avoid."}`,
    `- Comma splices: ${r.commaSplicesAllowed ? "occasional ones are fine in a casual mood, they make prose feel breathy." : "avoid."}`,
    `- Slang/industry shorthand: ${r.slang === "liberal" ? "use freely where it fits the persona and audience." : r.slang === "moderate" ? "ok in moderation if it fits the persona." : "minimal; stay close to plain language."}`,
    `- Vary sentence length aggressively. Mix one-word punches with longer sentences. Aim for an average of ~${r.avgSentenceLen} words but never feel uniform.`,
    `- Target reading ease: ~${r.fleschTarget} on the Flesch scale (higher = simpler). If a reader needs a thesaurus, you've gone wrong.`,
  ];
  return parts.join("\n");
}

// Render the banned vocabulary as a single inline list for the prompt.
export function describeBannedVocab(): string {
  const list = BANNED_WORDS.map((w) => `"${w}"`).join(", ");
  return `Never use these words/phrases (they read as AI-generated): ${list}. If you need to express the idea, find another way to say it.`;
}

// Render banned structural patterns with short examples.
export function describeBannedPatterns(): string {
  const items = BANNED_PATTERNS.map((p) => `- ${p.description}`).join("\n");
  return `Never use these sentence structures (they're AI tells):
${items}
Also avoid: rhetorical questions opening more than one of the first three sentences; perfectly parallel triplets ("X, Y, and Z" three times in close proximity); paragraphs that are all the same length.`;
}

// ---------- Detection (post-process) ----------

export interface AITellReport {
  bannedWords: string[];
  bannedPatterns: string[];
  flesch: number;
}

export function detectBannedWords(text: string): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const w of BANNED_WORDS) {
    // Word-boundary for single tokens; substring for multi-word phrases
    // (which already include their own boundaries via spaces/apostrophes).
    if (w.includes(" ") || w.includes("'")) {
      if (lower.includes(w.toLowerCase())) found.push(w);
    } else {
      const re = new RegExp(`\\b${w.replace(/-/g, "\\-")}\\b`, "i");
      if (re.test(text)) found.push(w);
    }
  }
  return found;
}

export function detectBannedPatterns(text: string): string[] {
  const found: string[] = [];
  for (const p of BANNED_PATTERNS) {
    if (p.regex.test(text)) found.push(p.name);
  }
  return found;
}

// ---------- Flesch reading ease (dependency-free) ----------

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  // Strip common silent endings.
  const stripped = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "")
    .replace(/^y/, "");
  const groups = stripped.match(/[aeiouy]+/g);
  return Math.max(1, groups ? groups.length : 1);
}

export function fleschReadingEase(text: string): number {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return 100;
  const sentences = cleaned.split(/[.!?]+(?:\s|$)/).filter(Boolean).length || 1;
  const words = cleaned.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w));
  const wordCount = words.length || 1;
  const syllables = words.reduce((sum, w) => sum + countSyllables(w), 0) || 1;
  // Flesch Reading Ease = 206.835 - 1.015*(words/sentences) - 84.6*(syllables/words)
  const score =
    206.835 - 1.015 * (wordCount / sentences) - 84.6 * (syllables / wordCount);
  return Math.round(score * 10) / 10;
}

export function detectAITells(text: string): AITellReport {
  return {
    bannedWords: detectBannedWords(text),
    bannedPatterns: detectBannedPatterns(text),
    flesch: fleschReadingEase(text),
  };
}
