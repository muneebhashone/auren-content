import Papa from "papaparse";

export interface ParsedFeedbackRow {
  rowNumber: number;
  postId: number;
  impressions: number;
  likes: number;
  comments: number;
  reposts: number;
  qualitativeNote: string;
}

export interface FeedbackRowError {
  rowNumber: number;
  message: string;
  raw?: Record<string, string>;
}

export interface ParsedFeedbackResult {
  rows: ParsedFeedbackRow[];
  errors: FeedbackRowError[];
}

const FIELD_ALIASES: Record<keyof Omit<ParsedFeedbackRow, "rowNumber">, string[]> = {
  postId: ["post_id", "postid", "post id", "id"],
  impressions: ["impressions", "views", "imp"],
  likes: ["likes", "reactions"],
  comments: ["comments", "replies"],
  reposts: ["reposts", "shares", "retweets", "reshares"],
  qualitativeNote: ["qualitative_note", "note", "notes", "qualitative"],
};

function normalizeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "_");
}

function pick(
  row: Record<string, string>,
  aliases: string[]
): string | undefined {
  for (const a of aliases) {
    const norm = normalizeKey(a);
    if (norm in row) return row[norm];
  }
  return undefined;
}

function toInt(value: string | undefined): number {
  if (value == null) return 0;
  const trimmed = value.trim();
  if (trimmed === "") return 0;
  const n = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export function parseFeedbackCsv(csv: string): ParsedFeedbackResult {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => normalizeKey(h),
  });

  const rows: ParsedFeedbackRow[] = [];
  const errors: FeedbackRowError[] = [];

  if (result.errors && result.errors.length > 0) {
    for (const e of result.errors) {
      errors.push({
        rowNumber: (e.row ?? 0) + 2,
        message: e.message,
      });
    }
  }

  const data = result.data ?? [];
  data.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    const postIdRaw = pick(raw, FIELD_ALIASES.postId);
    if (postIdRaw == null || postIdRaw.trim() === "") {
      errors.push({ rowNumber, message: "Missing post_id", raw });
      return;
    }
    const postIdNum = Number(postIdRaw.trim());
    if (!Number.isFinite(postIdNum) || !Number.isInteger(postIdNum) || postIdNum <= 0) {
      errors.push({
        rowNumber,
        message: `Invalid post_id "${postIdRaw}"`,
        raw,
      });
      return;
    }

    rows.push({
      rowNumber,
      postId: postIdNum,
      impressions: toInt(pick(raw, FIELD_ALIASES.impressions)),
      likes: toInt(pick(raw, FIELD_ALIASES.likes)),
      comments: toInt(pick(raw, FIELD_ALIASES.comments)),
      reposts: toInt(pick(raw, FIELD_ALIASES.reposts)),
      qualitativeNote: (pick(raw, FIELD_ALIASES.qualitativeNote) ?? "").trim(),
    });
  });

  return { rows, errors };
}
