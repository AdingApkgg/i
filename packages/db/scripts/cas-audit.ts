/**
 * 内容寻址存储巡检 / 清理。
 *
 *   DATABASE_URL=… S3_… bun packages/db/scripts/cas-audit.ts           # 只报
 *   … --apply                                                          # 删孤儿
 *
 * 报两类问题：
 *  - missing：库里有引用但对象不在 → 页面会 404，必须查；
 *  - orphan：对象在但没人引用 → 内容寻址下等于重复份（内容已由别的 key 承担）
 *    或历史残留。确认内容在别处存在才可删，脚本会逐个比对 sha256。
 *
 * 只删 `--apply` 且确认过的孤儿；缩略图一并清掉。
 */
import { createHash } from "node:crypto";
import { Client } from "pg";
import { createStorage, storageConfigFromEnv } from "../src/storage";

const STORED = "/api/gallery/files/";
const CAS = /^[0-9a-f]{64}\.[a-z0-9]+$/;
const APPLY = process.argv.includes("--apply");
const WIDTHS = [320, 640, 960, 1280, 1920, 2560];

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

async function referenced() {
  const refs = new Set<string>();
  for (const [table, column, json] of TARGETS) {
    const text = json ? `"${column}"::text` : `"${column}"`;
    const { rows } = await db.query<{ val: string }>(
      `select ${text} as val from "${table}" where position($1 in ${text}) > 0`,
      [STORED],
    );
    for (const { val } of rows) {
      for (const m of val.matchAll(/\/api\/gallery\/files\/([^"'\s()?#\\]+)/g))
        refs.add(decodeURIComponent(m[1]!));
    }
  }
  return refs;
}

async function sha(key: string) {
  const obj = await storage.get(key);
  if (!obj) return null;
  return createHash("sha256")
    .update(new Uint8Array(await obj.arrayBuffer()))
    .digest("hex");
}

async function main() {
  await db.connect();
  const refs = await referenced();
  const objects: { key: string; size: number }[] = [];
  for await (const o of storage.list("")) if (!o.key.startsWith("thumbs/")) objects.push(o);

  const keys = await Promise.all(objects.map(async (o) => ({ ...o, hash: await sha(o.key) })));
  const byHash = new Map<string, string[]>();
  for (const o of keys) if (o.hash) byHash.set(o.hash, [...(byHash.get(o.hash) ?? []), o.key]);

  const missing = [...refs].filter((k) => !objects.some((o) => o.key === k));
  console.log(`refs ${refs.size} / objects ${objects.length}`);
  for (const k of missing) console.log(`[missing] ${k}`);

  // 旧式 key（uuid / 短哈希前缀）先归一到内容寻址，否则改天同名内容又上传会重复
  for (const o of keys) {
    if (CAS.test(o.key) || !o.hash) continue;
    const next = `${o.hash}.${o.key.split(".").pop()}`;
    console.log(`[normalize] ${o.key} → ${next}`);
    if (!APPLY) continue;
    if (!(await storage.head(next))) {
      const obj = await storage.get(o.key);
      if (obj)
        await storage.put(
          next,
          new Uint8Array(await obj.arrayBuffer()),
          obj.headers.get("content-type") ?? "application/octet-stream",
        );
    }
    await storage.delete(o.key);
    for (const w of WIDTHS) await storage.delete(`thumbs/w${w}/${o.key}.webp`);
    o.key = next;
  }

  const orphans = keys.filter((o) => !refs.has(o.key));
  for (const o of orphans) {
    const canonical = (byHash.get(o.hash ?? "") ?? []).filter((k) => k !== o.key && refs.has(k));
    const state = canonical.length ? `dup of ${canonical[0]}` : "no reference";
    console.log(`[orphan] ${o.key} (${o.size}B) ${state}`);
    if (!APPLY) continue;
    await storage.delete(o.key);
    for (const w of WIDTHS) await storage.delete(`thumbs/w${w}/${o.key}.webp`);
  }
  console.log(
    JSON.stringify({
      apply: APPLY,
      refs: refs.size,
      objects: objects.length,
      missing: missing.length,
      orphans: orphans.length,
    }),
  );
  if (missing.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.end());
