ALTER TABLE "Page" ALTER COLUMN "contentMd" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "Post" ALTER COLUMN "contentMd" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "Page" ADD COLUMN "content" jsonb;--> statement-breakpoint
ALTER TABLE "Post" ADD COLUMN "content" jsonb;