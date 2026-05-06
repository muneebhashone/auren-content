ALTER TABLE `personas` ADD `subreddits_json` text DEFAULT '[]' NOT NULL;
--> statement-breakpoint
ALTER TABLE `posts` ADD `title` text;
--> statement-breakpoint
ALTER TABLE `posts` ADD `subreddit` text;
