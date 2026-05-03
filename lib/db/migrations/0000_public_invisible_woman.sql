CREATE TABLE `business_profile` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`region` text DEFAULT '' NOT NULL,
	`icp` text DEFAULT '' NOT NULL,
	`services_json` text DEFAULT '[]' NOT NULL,
	`brand_pillars` text DEFAULT '' NOT NULL,
	`anti_goals` text DEFAULT '' NOT NULL,
	`voice_global` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `performance_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`impressions` integer DEFAULT 0 NOT NULL,
	`likes` integer DEFAULT 0 NOT NULL,
	`comments` integer DEFAULT 0 NOT NULL,
	`reposts` integer DEFAULT 0 NOT NULL,
	`qualitative_note` text DEFAULT '' NOT NULL,
	`imported_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `personas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`voice_profile_md` text DEFAULT '' NOT NULL,
	`dos` text DEFAULT '' NOT NULL,
	`donts` text DEFAULT '' NOT NULL,
	`sample_phrases` text DEFAULT '' NOT NULL,
	`platforms_json` text DEFAULT '[]' NOT NULL,
	`cadence_json` text DEFAULT '{}' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_id` integer NOT NULL,
	`persona_id` integer NOT NULL,
	`platform` text NOT NULL,
	`scheduled_for` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`hook` text DEFAULT '' NOT NULL,
	`hashtags_json` text DEFAULT '[]' NOT NULL,
	`image_prompt` text DEFAULT '' NOT NULL,
	`alt_hooks_json` text DEFAULT '[]' NOT NULL,
	`rationale_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`week_id`) REFERENCES `weekly_briefs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `quarterly_goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`quarter` text NOT NULL,
	`objective` text NOT NULL,
	`narrative` text DEFAULT '' NOT NULL,
	`success_metrics` text DEFAULT '' NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rationale_citations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`post_id` integer NOT NULL,
	`claim_key` text NOT NULL,
	`claim` text NOT NULL,
	`source_kind` text NOT NULL,
	`source_id` integer,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `research_signals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`week_id` integer,
	`source_url` text DEFAULT '' NOT NULL,
	`summary` text NOT NULL,
	`kind` text NOT NULL,
	`fetched_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`week_id`) REFERENCES `weekly_briefs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `weekly_briefs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`iso_week` text NOT NULL,
	`focus` text DEFAULT '' NOT NULL,
	`target_segment` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`week_plan_json` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_briefs_iso_week_unique` ON `weekly_briefs` (`iso_week`);