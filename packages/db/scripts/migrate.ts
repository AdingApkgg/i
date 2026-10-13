/**
 * 部署时执行的数据库迁移：按顺序应用 drizzle/ 下的 SQL 迁移文件（drizzle-kit generate 生成、
 * 随代码提交、可审阅），已执行的记在 drizzle.__drizzle_migrations，重复运行无副作用。
 * 取代原来的 drizzle-kit push --force（改名字段时会静默删列重建）。
 *
 * 基线：现有的库（当初由 Prisma / drizzle-kit push 建好，表都在、但没有迁移记录）
 * 不能再跑 0000_init 的 CREATE TABLE —— 检测到这种情况时只把 0000 记为已执行，
 * 之后的迁移照常应用。
 *
 *   DATABASE_URL=… bun packages/db/scripts/migrate.ts
 */
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

// 单独一条连接（不用连接池）：advisory lock 是会话级的，加锁、迁移、解锁必须在同一个连接上
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const db = drizzle(client);

const migrationsFolder = fileURLToPath(new URL("../drizzle", import.meta.url));
// 与 drizzle-orm 迁移器的默认值一致
const SCHEMA = sql.identifier("drizzle");
const TABLE = sql.identifier("__drizzle_migrations");
// 任意常量：同一时刻只允许一个进程跑迁移
const LOCK_KEY = 0x69_76_32; // "iv2"

async function baselineIfNeeded() {
  const [init] = readMigrationFiles({ migrationsFolder });
  if (!init) return;
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`);
  await db.execute(
    sql`CREATE TABLE IF NOT EXISTS ${SCHEMA}.${TABLE} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
  );
  const recorded = await db.execute<{ n: number }>(
    sql`SELECT count(*)::int AS n FROM ${SCHEMA}.${TABLE}`,
  );
  if (recorded.rows[0]!.n > 0) return;
  const existing = await db.execute<{ e: boolean }>(
    sql`SELECT to_regclass('public."User"') IS NOT NULL AS e`,
  );
  if (!existing.rows[0]!.e) return; // 空库：0000 正常执行
  await db.execute(
    sql`INSERT INTO ${SCHEMA}.${TABLE} (hash, created_at) VALUES (${init.hash}, ${init.folderMillis})`,
  );
  console.log("已有表结构、无迁移记录：0000_init 记为已执行（基线）");
}

async function main() {
  await client.connect();
  await db.execute(sql`SELECT pg_advisory_lock(${LOCK_KEY})`);
  try {
    await baselineIfNeeded();
    await migrate(db, { migrationsFolder });
    const done = await db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM ${SCHEMA}.${TABLE}`,
    );
    console.log(`✓ 数据库迁移完成（已记录 ${done.rows[0]!.n} 个）`);
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(${LOCK_KEY})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => client.end());
