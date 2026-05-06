// Belt-and-suspenders cleanup applied after the LLM polish step. The prompts
// already forbid em dashes and (for Reddit) inline emphasis markdown, but
// models still occasionally slip them in. This is the last line of defense
// before content hits the database.

const EM_DASH = /—/g; // —
const EN_DASH = /–/g; // –

function stripDashes(s: string): string {
  return s.replace(EM_DASH, ", ").replace(EN_DASH, "-");
}

// Matches **bold**, __bold__, *italic*, _italic_, `code` while leaving the
// inner text intact. Conservative: only strips paired markers around at least
// one word character, so legit asterisks-in-prose don't get mangled.
function stripInlineMarkdown(s: string): string {
  return s
    .replace(/\*\*(\S(?:.*?\S)?)\*\*/g, "$1")
    .replace(/__(\S(?:.*?\S)?)__/g, "$1")
    .replace(/(?<!\*)\*(\S(?:.*?\S)?)\*(?!\*)/g, "$1")
    .replace(/(?<!_)_(\S(?:.*?\S)?)_(?!_)/g, "$1")
    .replace(/`([^`\n]+)`/g, "$1");
}

export function sanitizeForPlatform(
  platform: "x" | "linkedin" | "reddit",
  text: string
): string {
  let out = stripDashes(text);
  if (platform === "reddit") {
    out = stripInlineMarkdown(out);
  }
  return out;
}
