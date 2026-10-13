import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pgPool: Pool | undefined };

// 连接池懒连接：构建期 / 无 DATABASE_URL 时不会真正建连，查询才会报错
const pool = globalForDb.pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL });

// 数据库重启 / 维护时，空闲连接被断开会在 Pool 上触发 error 事件；
// 不监听的话 Node 会把它当未处理异常、整个进程崩溃。记日志即可，下次查询会自动建新连接。
if (!globalForDb.pgPool) {
  pool.on("error", (err) => console.error("[db] 空闲连接出错（已丢弃）:", err.message));
}

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgPool = pool;
}

export const db = drizzle(pool, { schema });
export type Db = typeof db;
