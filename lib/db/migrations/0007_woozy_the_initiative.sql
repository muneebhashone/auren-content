CREATE TABLE `story_bank` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`persona_id` integer,
	`last_used_at` text,
	`use_count` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (`persona_id`) REFERENCES `personas`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
ALTER TABLE `posts` ADD `content_type` text DEFAULT 'research' NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `story_bank_id` integer REFERENCES story_bank(id);
