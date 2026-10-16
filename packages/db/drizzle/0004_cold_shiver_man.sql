CREATE TABLE "AiTranslation" (
	"id" text PRIMARY KEY NOT NULL,
	"baseUrl" text NOT NULL,
	"model" text NOT NULL,
	"encryptedApiKey" text,
	"enabled" boolean DEFAULT false NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Device" ADD COLUMN "imageUrl" text;--> statement-breakpoint
ALTER TABLE "Vn" ADD COLUMN "vndbId" text;--> statement-breakpoint
ALTER TABLE "Vn" ADD COLUMN "released" text;--> statement-breakpoint
ALTER TABLE "Vn" ADD COLUMN "vndbRating" double precision;--> statement-breakpoint
ALTER TABLE "Vn" ADD COLUMN "descriptionOriginal" text;--> statement-breakpoint
ALTER TABLE "Vn" ADD COLUMN "descriptionZh" text;--> statement-breakpoint
CREATE UNIQUE INDEX "Vn_vndbId_key" ON "Vn" USING btree ("vndbId");