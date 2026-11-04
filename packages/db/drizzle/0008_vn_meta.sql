ALTER TABLE "Vn" ADD COLUMN "bgmId" integer;--> statement-breakpoint
ALTER TABLE "Vn" ADD COLUMN "tags" text[];--> statement-breakpoint
ALTER TABLE "Vn" ADD COLUMN "platforms" text[];--> statement-breakpoint
ALTER TABLE "Vn" ADD COLUMN "lengthMinutes" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "Vn_bgmId_key" ON "Vn" USING btree ("bgmId");
