ALTER TABLE `posts` ADD `image_url` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `posts` ADD `image_provider` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `posts` ADD `image_generated_at` text;
