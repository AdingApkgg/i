/**
 * 一次性存储迁移：把旧对象存储（MinIO）里的相册文件原样复制到新的（SeaweedFS）。
 * 数据库里存的是 /api/gallery/files/<key>，只要 key 不变，数据库一行都不用改。
 *
 * 幂等：目标已存在且大小相同的对象直接跳过，中断后重跑即可。
 * 不删源数据：确认新站图片都正常后，再自行移除旧的 MinIO 卷。
 *
 *   SRC_S3_ENDPOINT=http://minio:9000 SRC_S3_ACCESS_KEY=… SRC_S3_SECRET_KEY=… \
 *   S3_ENDPOINT=http://seaweedfs:8333 S3_ACCESS_KEY=… S3_SECRET_KEY=… \
 *   bun packages/db/scripts/migrate-storage.ts
 *
 * 桶名默认 gallery；源桶可用 SRC_S3_BUCKET 单独指定。
 */
import { createStorage, storageConfigFromEnv } from "../src/storage";

const CONCURRENCY = 4;

if (!process.env.SRC_S3_ENDPOINT) {
  console.error("缺少 SRC_S3_ENDPOINT（旧存储地址，如 http://minio:9000）");
  process.exit(1);
}

const dst = createStorage(storageConfigFromEnv());
const srcCfg = storageConfigFromEnv("SRC_");
const src = createStorage({ ...srcCfg, bucket: process.env.SRC_S3_BUCKET ?? dst.bucket });

let copied = 0;
let skipped = 0;
let failed = 0;

async function copyOne(key: string, size: number) {
  try {
    const existing = await dst.head(key);
    if (existing && existing.size === size) {
      skipped++;
      return;
    }
    const obj = await src.get(key);
    if (!obj) throw new Error("源对象消失了");
    const body = new Uint8Array(await obj.arrayBuffer());
    await dst.put(key, body, obj.headers.get("content-type") ?? "application/octet-stream");
    copied++;
    console.log(`[ok] ${key} (${size} B)`);
  } catch (e) {
    failed++;
    console.error(`[fail] ${key}: ${String(e)}`);
  }
}

async function main() {
  await dst.ensureBucket();
  const queue: Promise<void>[] = [];
  let total = 0;
  for await (const { key, size } of src.list()) {
    total++;
    queue.push(copyOne(key, size));
    if (queue.length >= CONCURRENCY) await Promise.all(queue.splice(0));
  }
  await Promise.all(queue);
  console.log({ total, copied, skipped, failed });
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
