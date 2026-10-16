CREATE TABLE "MasturbationDay" (
	"date" date PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"createdAt" timestamp (3) DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updatedAt" timestamp (3) NOT NULL,
	CONSTRAINT "MasturbationDay_count_check" CHECK ("MasturbationDay"."count" > 0 AND "MasturbationDay"."count" <= 1000)
);
