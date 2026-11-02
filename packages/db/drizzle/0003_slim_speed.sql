ALTER TABLE "BangumiAccount" ADD COLUMN "lastAttemptAt" timestamp (3);--> statement-breakpoint
ALTER TABLE "BangumiEntry" ADD COLUMN "writeUncertain" boolean DEFAULT false NOT NULL;