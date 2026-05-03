import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

const id = () => integer("id").primaryKey({ autoIncrement: true });
const ts = (name: string) =>
  text(name).notNull().default(sql`(CURRENT_TIMESTAMP)`);

// Singleton: there's exactly one business profile (id = 1)
export const businessProfile = sqliteTable("business_profile", {
  id: id(),
  region: text("region").notNull().default(""),
  icp: text("icp").notNull().default(""),
  // Service catalog: [{name, description, priceRange?}]
  servicesJson: text("services_json").notNull().default("[]"),
  brandPillars: text("brand_pillars").notNull().default(""),
  antiGoals: text("anti_goals").notNull().default(""),
  voiceGlobal: text("voice_global").notNull().default(""),
  updatedAt: ts("updated_at"),
});

export const quarterlyGoals = sqliteTable("quarterly_goals", {
  id: id(),
  // e.g. "2026-Q2"
  quarter: text("quarter").notNull(),
  objective: text("objective").notNull(),
  narrative: text("narrative").notNull().default(""),
  successMetrics: text("success_metrics").notNull().default(""),
  active: integer("active", { mode: "boolean" }).notNull().default(false),
  createdAt: ts("created_at"),
});

export const personas = sqliteTable("personas", {
  id: id(),
  name: text("name").notNull(),
  role: text("role").notNull().default(""),
  voiceProfileMd: text("voice_profile_md").notNull().default(""),
  dos: text("dos").notNull().default(""),
  donts: text("donts").notNull().default(""),
  samplePhrases: text("sample_phrases").notNull().default(""),
  // ["x", "linkedin"]
  platformsJson: text("platforms_json").notNull().default("[]"),
  // {x: 3, linkedin: 2}
  cadenceJson: text("cadence_json").notNull().default("{}"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: ts("created_at"),
});

export const weeklyBriefs = sqliteTable("weekly_briefs", {
  id: id(),
  // ISO year + week, e.g. "2026-W18"
  isoWeek: text("iso_week").notNull().unique(),
  focus: text("focus").notNull().default(""),
  targetSegment: text("target_segment").notNull().default(""),
  notes: text("notes").notNull().default(""),
  // Snapshot of the week plan emitted by the strategy synthesizer step
  weekPlanJson: text("week_plan_json"),
  // System-suggested alternative angles (the brief suggester output)
  suggestedIdeasJson: text("suggested_ideas_json"),
  suggestedAt: text("suggested_at"),
  createdAt: ts("created_at"),
});

export const researchSignals = sqliteTable("research_signals", {
  id: id(),
  weekId: integer("week_id").references(() => weeklyBriefs.id, {
    onDelete: "cascade",
  }),
  sourceUrl: text("source_url").notNull().default(""),
  summary: text("summary").notNull(),
  // trend | competitor | news | user_pasted
  kind: text("kind").notNull(),
  fetchedAt: ts("fetched_at"),
});

export const posts = sqliteTable("posts", {
  id: id(),
  weekId: integer("week_id")
    .notNull()
    .references(() => weeklyBriefs.id, { onDelete: "cascade" }),
  personaId: integer("persona_id")
    .notNull()
    .references(() => personas.id, { onDelete: "restrict" }),
  // x | linkedin
  platform: text("platform").notNull(),
  // ISO timestamp string for the suggested slot
  scheduledFor: text("scheduled_for").notNull(),
  // draft | approved | posted | logged
  status: text("status").notNull().default("draft"),
  body: text("body").notNull().default(""),
  hook: text("hook").notNull().default(""),
  // JSON array of strings
  hashtagsJson: text("hashtags_json").notNull().default("[]"),
  imagePrompt: text("image_prompt").notNull().default(""),
  // [{hook, reasoning}]
  altHooksJson: text("alt_hooks_json").notNull().default("[]"),
  // structured rationale: {hookStrategy, audience, slotReasoning, viralityLever, expectedOutcome}
  rationaleJson: text("rationale_json").notNull().default("{}"),
  createdAt: ts("created_at"),
  updatedAt: ts("updated_at"),
});

export const rationaleCitations = sqliteTable("rationale_citations", {
  id: id(),
  postId: integer("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  // which rationale field this citation supports
  claimKey: text("claim_key").notNull(),
  claim: text("claim").notNull(),
  // signal | persona | performance | profile | goal | brief
  sourceKind: text("source_kind").notNull(),
  sourceId: integer("source_id"),
});

export const performanceRecords = sqliteTable("performance_records", {
  id: id(),
  postId: integer("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  impressions: integer("impressions").notNull().default(0),
  likes: integer("likes").notNull().default(0),
  comments: integer("comments").notNull().default(0),
  reposts: integer("reposts").notNull().default(0),
  qualitativeNote: text("qualitative_note").notNull().default(""),
  importedAt: ts("imported_at"),
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  // arbitrary JSON value
  valueJson: text("value_json").notNull(),
  updatedAt: ts("updated_at"),
});

export type BusinessProfile = typeof businessProfile.$inferSelect;
export type QuarterlyGoal = typeof quarterlyGoals.$inferSelect;
export type Persona = typeof personas.$inferSelect;
export type WeeklyBrief = typeof weeklyBriefs.$inferSelect;
export type ResearchSignal = typeof researchSignals.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type RationaleCitation = typeof rationaleCitations.$inferSelect;
export type PerformanceRecord = typeof performanceRecords.$inferSelect;
export type Setting = typeof settings.$inferSelect;
