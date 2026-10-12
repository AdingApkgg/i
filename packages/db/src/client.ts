import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgPool: Pool | undefined };

// 连接池懒连接：构建期 / 无 DATABASE_URL 时不会真正建连，查询才会报错
const pool = globalForDb.pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgPool = pool;
}

export const db = drizzle(pool, { schema });
export type Db = typeof db;
