export type Variant = {
  hook: string;
  body: string;
  hashtags: string[];
  // Reddit-only: post title. Empty/omitted on x/linkedin.
  title?: string;
  // gpt-image-2 prompt produced by the writer; empty when none was generated.
  imagePrompt?: string;
  // Public path to the generated image, e.g. "/generated/rewrite-12-x-polished-...png".
  imageUrl?: string;
};
export type REDACTED_NON_SECRET_IDENTIFIER = { polished: Variant; faithful: Variant };
export type Signal = { summary: string; sourceUrl: string };
export type Variants = {
  linkedin: REDACTED_NON_SECRET_IDENTIFIER;
  x: REDACTED_NON_SECRET_IDENTIFIER;
  reddit: REDACTED_NON_SECRET_IDENTIFIER;
};
