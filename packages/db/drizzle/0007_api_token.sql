CREATE TABLE "ApiToken" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"tokenHash" text NOT NULL,
	"scope" text DEFAULT 'read' NOT NULL,
	"lastUsedAt" timestamp (3),
	"expiresAt" timestamp (3),
	"revokedAt" timestamp (3),
	"userId" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ApiToken_tokenHash_key" ON "ApiToken" USING btree ("tokenHash");--> statement-breakpoint
CREATE INDEX "ApiToken_userId_idx" ON "ApiToken" USING btree ("userId");--> statement-breakpoint
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;
