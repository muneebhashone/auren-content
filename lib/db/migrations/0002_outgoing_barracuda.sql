CREATE TABLE `generation_jobs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`iso_week` text NOT NULL,
	`status` text DEFAULT 'running' NOT NULL,
	`stage` text DEFAULT 'init' NOT NULL,
	`stage_label` text DEFAULT '' NOT NULL,
	`total_slots` integer,
	`current_slot` integer,
	`posts_created` integer DEFAULT 0 NOT NULL,
	`signals_fetched` integer DEFAULT 0 NOT NULL,
	`error_message` text DEFAULT '' NOT NULL,
	`started_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`finished_at` text
);
