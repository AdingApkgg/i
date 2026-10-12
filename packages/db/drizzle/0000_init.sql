CREATE TABLE "Account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp (3),
	"refreshTokenExpiresAt" timestamp (3),
	"scope" text,
	"password" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Album" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"coverUrl" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Comment" (
	"id" text PRIMARY KEY NOT NULL,
	"path" text NOT NULL,
	"contentMd" text NOT NULL,
	"status" text DEFAULT 'visible' NOT NULL,
	"userId" text NOT NULL,
	"postId" text,
	"parentId" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Device" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text,
	"spec" text,
	"status" text DEFAULT '在用' NOT NULL,
	"acquired" text,
	"link" text,
	"note" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Friend" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"avatarUrl" text,
	"description" text,
	"group" text,
	"status" text DEFAULT 'active' NOT NULL,
	"email" text,
	"message" text,
	"applicantId" text,
	"reachable" boolean,
	"backlinked" boolean,
	"failCount" integer DEFAULT 0 NOT NULL,
	"checkedAt" timestamp (3),
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MaimaiConfig" (
	"id" text PRIMARY KEY DEFAULT 'current' NOT NULL,
	"source" text DEFAULT 'diving-fish' NOT NULL,
	"divingFishUsername" text,
	"divingFishImportToken" text,
	"lxnsPersonalToken" text,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MaimaiProfile" (
	"id" text PRIMARY KEY DEFAULT 'current' NOT NULL,
	"source" text NOT NULL,
	"nickname" text NOT NULL,
	"rating" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MaimaiRecord" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"songId" integer NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"levelIndex" integer NOT NULL,
	"levelLabel" text NOT NULL,
	"ds" double precision,
	"achievements" double precision DEFAULT 0 NOT NULL,
	"dxScore" integer DEFAULT 0 NOT NULL,
	"ra" integer DEFAULT 0 NOT NULL,
	"fc" text,
	"fs" text,
	"rate" text,
	"coverUrl" text,
	"pool" text,
	"boardOrder" integer DEFAULT 0 NOT NULL,
	"syncedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Moment" (
	"id" text PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"mood" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Monitor" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"target" text NOT NULL,
	"kind" text DEFAULT 'http' NOT NULL,
	"intervalSec" integer DEFAULT 60 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MonitorCheck" (
	"id" text PRIMARY KEY NOT NULL,
	"monitorId" text NOT NULL,
	"ok" boolean NOT NULL,
	"statusCode" integer,
	"latencyMs" integer,
	"checkedAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Movie" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"category" text,
	"status" text DEFAULT '在看' NOT NULL,
	"rating" integer,
	"year" integer,
	"coverUrl" text,
	"link" text,
	"note" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Page" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"contentMd" text NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Photo" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"imageUrl" text NOT NULL,
	"thumbUrl" text,
	"description" text,
	"takenAt" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"albumId" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Post" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"contentMd" text NOT NULL,
	"coverUrl" text,
	"tags" text[],
	"status" text DEFAULT 'draft' NOT NULL,
	"publishedAt" timestamp (3),
	"views" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp (3) NOT NULL,
	"token" text NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Touhou" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"category" text,
	"status" text DEFAULT '收藏' NOT NULL,
	"rating" integer,
	"coverUrl" text,
	"link" text,
	"note" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Track" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"artist" text,
	"album" text,
	"status" text DEFAULT '在听' NOT NULL,
	"rating" integer,
	"coverUrl" text,
	"link" text,
	"note" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"name" text,
	"image" text,
	"role" text DEFAULT 'user' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"banReason" text,
	"banExpiresAt" timestamp (3),
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp (3) NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Vn" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"brand" text,
	"status" text DEFAULT '在玩' NOT NULL,
	"rating" integer,
	"playHours" integer,
	"coverUrl" text,
	"link" text,
	"note" text,
	"sortOrder" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."Post"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."Comment"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "MonitorCheck" ADD CONSTRAINT "MonitorCheck_monitorId_fkey" FOREIGN KEY ("monitorId") REFERENCES "public"."Monitor"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "public"."Album"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "Account_userId_idx" ON "Account" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account" USING btree ("providerId","accountId");--> statement-breakpoint
CREATE UNIQUE INDEX "Album_name_key" ON "Album" USING btree ("name");--> statement-breakpoint
CREATE INDEX "Album_sortOrder_createdAt_idx" ON "Album" USING btree ("sortOrder","createdAt");--> statement-breakpoint
CREATE INDEX "Comment_path_createdAt_idx" ON "Comment" USING btree ("path","createdAt");--> statement-breakpoint
CREATE INDEX "Comment_postId_idx" ON "Comment" USING btree ("postId");--> statement-breakpoint
CREATE INDEX "Device_status_createdAt_idx" ON "Device" USING btree ("status","createdAt");--> statement-breakpoint
CREATE INDEX "Friend_status_sortOrder_idx" ON "Friend" USING btree ("status","sortOrder");--> statement-breakpoint
CREATE INDEX "MaimaiRecord_pool_boardOrder_idx" ON "MaimaiRecord" USING btree ("pool","boardOrder");--> statement-breakpoint
CREATE INDEX "MaimaiRecord_achievements_idx" ON "MaimaiRecord" USING btree ("achievements");--> statement-breakpoint
CREATE UNIQUE INDEX "MaimaiRecord_songId_type_levelIndex_key" ON "MaimaiRecord" USING btree ("songId","type","levelIndex");--> statement-breakpoint
CREATE INDEX "Moment_createdAt_idx" ON "Moment" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "Monitor_enabled_kind_idx" ON "Monitor" USING btree ("enabled","kind");--> statement-breakpoint
CREATE INDEX "MonitorCheck_monitorId_checkedAt_idx" ON "MonitorCheck" USING btree ("monitorId","checkedAt");--> statement-breakpoint
CREATE INDEX "Movie_status_createdAt_idx" ON "Movie" USING btree ("status","createdAt");--> statement-breakpoint
CREATE INDEX "Photo_createdAt_idx" ON "Photo" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "Photo_albumId_idx" ON "Photo" USING btree ("albumId");--> statement-breakpoint
CREATE UNIQUE INDEX "Post_slug_key" ON "Post" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "Post_status_publishedAt_idx" ON "Post" USING btree ("status","publishedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "Session_token_key" ON "Session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "Session_userId_idx" ON "Session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Touhou_category_createdAt_idx" ON "Touhou" USING btree ("category","createdAt");--> statement-breakpoint
CREATE INDEX "Track_status_createdAt_idx" ON "Track" USING btree ("status","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "User_email_key" ON "User" USING btree ("email");--> statement-breakpoint
CREATE INDEX "User_email_idx" ON "User" USING btree ("email");--> statement-breakpoint
CREATE INDEX "Verification_identifier_idx" ON "Verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "Vn_status_createdAt_idx" ON "Vn" USING btree ("status","createdAt");