CREATE TABLE "Project" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"link" text,
	"repo" text,
	"imageUrl" text,
	"tag" text,
	"description" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Sponsor" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"avatarUrl" text,
	"platform" text DEFAULT '微信' NOT NULL,
	"amountCents" integer DEFAULT 0 NOT NULL,
	"amountText" text,
	"message" text,
	"sponsoredAt" timestamp(3),
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp(3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Post" ADD COLUMN "lang" text DEFAULT 'zh' NOT NULL;--> statement-breakpoint
ALTER TABLE "Post" ADD COLUMN "translationOf" text;--> statement-breakpoint
CREATE INDEX "Post_lang_status_publishedAt_idx" ON "Post" USING btree ("lang","status","publishedAt");--> statement-breakpoint
CREATE INDEX "Post_translationOf_idx" ON "Post" USING btree ("translationOf");--> statement-breakpoint
CREATE INDEX "Project_sortOrder_idx" ON "Project" USING btree ("sortOrder");--> statement-breakpoint
CREATE INDEX "Sponsor_sponsoredAt_idx" ON "Sponsor" USING btree ("sponsoredAt");
