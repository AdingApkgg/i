ALTER TABLE "Touhou" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "Touhou" ADD COLUMN "originalTitle" text;--> statement-breakpoint
ALTER TABLE "Touhou" ADD COLUMN "releasedAt" text;--> statement-breakpoint
CREATE INDEX "Touhou_releasedAt_idx" ON "Touhou" USING btree ("releasedAt");