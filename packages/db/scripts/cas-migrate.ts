/**
 * 一次性迁移：把对象存储里已有的随机 key（`<uuid>.<ext>`）改写成内容寻址 key（`<sha256>.<ext>`），
 * 并同步数据库里的引用。已在 CAS 形态的 key 跳过，重复运行安全。
 *
 * 每个对象：读内容 → 算 sha256 → 新 key 已存在就复用（同内容只留一份）→ 更新所有引用 →
 * 删掉旧对象和旧缩略图（缩略图按原 key 派生，首次访问时按新 key 重新生成）。
 *
 *   DATABASE_URL=postgres://… S3_ENDPOINT=… S3_ACCESS_KEY=… S3_SECRET_KEY=… \
 *   bun packages/db/scripts/cas-migrate.ts          # 预演，只统计
 *   … --apply                                      # 真写
 *
 * 动手前先备份数据库；旧对象在确认无误前不要清理源卷。
 */
import { createHash } from "node:crypto";
import { Client } from "pg";
import { createStorage, storageConfigFromEnv } from "../src/storage";

const STORED = "/api/gallery/files/";
const CAS = /^[0-9a-f]{64}\.[a-z0-9]+$/;
const APPLY = process.argv.includes("--apply");

/** 可能出现站内图片地址的列：[表, 列, 是否 jsonb] */
const TARGETS: [table: string, column: string, json: boolean][] = [
  ["Photo", "imageUrl", false],
  ["Photo", "thumbUrl", false],
  ["Album", "coverUrl", false],
  ["Post", "coverUrl", false],
  ["Post", "contentMd", false],
  ["Post", "content", true],
  ["Page", "contentMd", false],
  ["Page", "content", true],
  ["Comment", "contentMd", false],
  ["Moment", "content", true],
  ["Track", "coverUrl", false],
  ["Movie", "coverUrl", false],
  ["Vn", "coverUrl", false],
  ["Device", "imageUrl", false],
  ["Touhou", "coverUrl", false],
  ["Friend", "avatarUrl", false],
  ["User", "image", false],
];

const storage = createStorage(storageConfigFromEnv());
const db = new Client({ connectionString: process.env.DATABASE_URL });

const found = new Set<string>();

/** 收集库里出现过的 key 原文（可能是 %xx 编码的写法） */
async function collect() {
  for (const [table, column, json] of TARGETS) {
    const text = json ? `"${column}"::text` : `"${column}"`;
    const { rows } = await db.query<{ val: string }>(
      `select ${text} as val from "${table}" where position($1 in ${text}) > 0`,
      [STORED],
    );
    for (const { val } of rows) {
      // jsonb::text 会把内部引号转义成 `\"`，key 尾部会粘上反斜杠，统一去掉
      for (const m of val.matchAll(/\/api\/gallery\/files\/([^"'\s()?#\\]+)/g)) found.add(m[1]!);
    }
  }
}

function decode(raw: string) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * 把 raw（库里的写法）换成 next（新写法），返回改到的行数。
 * key 不含反斜杠，所以裸 key 的替换在 jsonb 里同样成立：
 * `…webp\"` 会被换成 `…<next>\"`，原有转义保留，结果仍是合法 JSON。
 */
async function rewrite(raw: string, next: string) {
  let rows = 0;
  for (const [table, column, json] of TARGETS) {
    const text = json ? `"${column}"::text` : `"${column}"`;
    const set = json ? `replace(${text}, $1, $2)::jsonb` : `replace(${text}, $1, $2)`;
    const res = await db.query(
      `update "${table}" set "${column}" = ${set} where position($1 in ${text}) > 0`,
      [raw, next],
    );
    rows += res.rowCount ?? 0;
  }
  return rows;
}

async function main() {
  await db.connect();
  await collect();

  const stats = { keys: found.size, alreadyCas: 0, migrated: 0, reused: 0, missing: 0, rows: 0 };
  for (const raw of [...found].sort()) {
    const key = decode(raw);
    if (CAS.test(key)) {
      stats.alreadyCas++;
      continue;
    }
    const obj = await storage.get(key);
    if (!obj) {
      console.warn(`[missing] ${key}`);
      stats.missing++;
      continue;
    }
    const bytes = new Uint8Array(await obj.arrayBuffer());
    const ext =
      key
        .split(".")
        .pop()
        ?.toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "bin";
    const next = `${createHash("sha256").update(bytes).digest("hex")}.${ext}`;

    const existing = await storage.head(next);
    if (!existing) {
      if (APPLY)
        await storage.put(
          next,
          bytes,
          obj.headers.get("content-type") ?? "application/octet-stream",
        );
      console.log(`[move] ${key} → ${next}`);
    } else {
      console.log(`[reuse] ${key} → ${next}`);
      stats.reused++;
    }
    stats.migrated++;

    if (!APPLY) continue;
    stats.rows += await rewrite(raw, next);
    await storage.delete(key);
    // 缩略图按原 key 派生，新 key 的仍在首次访问时生成
    for (const w of [320, 640, 960, 1280, 1920, 2560])
      await storage.delete(`thumbs/w${w}/${key}.webp`);
  }

  console.log(JSON.stringify({ apply: APPLY, ...stats }, null, 2));
  if (stats.missing > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.end());
