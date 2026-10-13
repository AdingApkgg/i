import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL! },
  // 只管 public schema 里本项目的表
  schemaFilter: ["public"],
});
