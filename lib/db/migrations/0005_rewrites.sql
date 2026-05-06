CREATE TABLE `rewrites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dump` text NOT NULL,
	`persona_id` integer,
	`persona_name` text DEFAULT '' NOT NULL,
	`fact_check` integer DEFAULT 0 NOT NULL,
	`variants_json` text DEFAULT '{}' NOT NULL,
	`signals_json` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE set null
);
