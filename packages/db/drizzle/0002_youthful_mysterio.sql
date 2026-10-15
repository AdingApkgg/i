CREATE TABLE "BangumiAccount" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" integer,
	"username" text DEFAULT '' NOT NULL,
	"initialized" boolean DEFAULT false NOT NULL,
	"autoSync" boolean DEFAULT false NOT NULL,
	"activeRunId" text,
	"activeSince" timestamp (3),
	"lastSyncedAt" timestamp (3),
	"lastError" text,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "BangumiEntry" (
	"subjectId" integer PRIMARY KEY NOT NULL,
	"metadata" jsonb NOT NULL,
	"state" jsonb NOT NULL,
	"baseline" jsonb,
	"lastRemote" jsonb,
	"revision" integer DEFAULT 0 NOT NULL,
	"syncStatus" text DEFAULT 'pending' NOT NULL,
	"syncError" text,
	"conflicts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "BangumiRun" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"progress" text DEFAULT '准备连接 Bangumi' NOT NULL,
	"data" jsonb,
	"error" text,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"expiresAt" timestamp (3) NOT NULL,
	"finishedAt" timestamp (3)
);
