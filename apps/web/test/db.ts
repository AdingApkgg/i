/**
 * 测试用数据库：PGlite（WASM 版 Postgres，进程内、内存里）+ 真实 Drizzle schema。
 * 表结构由仓库里的迁移文件（packages/db/drizzle）建出来，和线上部署走同一套 SQL，
 * 迁移本身也顺带被测到；唯一索引 / 外键 / 排序 / 键集分页都是真 SQL 行为。
 */
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import * as schema from "@i/db/schema";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Context } from "@/server/orpc";

export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../../../packages/db/drizzle", import.meta.url)),
  });
  const tables = Object.values(schema)
    .filter((v) => is(v, PgTable))
    .map((t) => `"${getTableName(t as PgTable)}"`);
  return {
    /** 类型上当作线上的 node-postgres 实例用（查询 API 完全一致） */
    db: db as unknown as Context["db"],
    /** 清空全部表，用于 beforeEach */
    reset: () => client.exec(`TRUNCATE ${tables.join(", ")} CASCADE`),
    close: () => client.close(),
  };
}

type Role = "user" | "admin" | "owner";

/** 构造 oRPC context：role 为空表示未登录。 */
export function makeContext(
  db: Context["db"],
  opts: { role?: Role; headers?: Record<string, string>; email?: string } = {},
): Context {
  const user = opts.role
    ? { id: "u1", role: opts.role, email: opts.email ?? "me@x.cc", image: null, name: "me" }
    : null;
  return {
    db,
    session: user ? ({ user } as unknown as Context["session"]) : null,
    user: user as unknown as Context["user"],
    headers: new Headers(opts.headers),
  };
}
