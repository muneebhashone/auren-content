export type Variant = { hook: string; body: string; hashtags: string[] };
export type REDACTED_NON_SECRET_IDENTIFIER = { polished: Variant; faithful: Variant };
export type Signal = { summary: string; sourceUrl: string };
export type Variants = {
  linkedin: REDACTED_NON_SECRET_IDENTIFIER;
  x: REDACTED_NON_SECRET_IDENTIFIER;
};
