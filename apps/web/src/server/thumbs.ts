/**
 * 相册缩略图：/api/gallery/files/<key>?w=640 → 等比缩到该宽度的 WebP（不放大）。
 * 首次请求用 sharp 生成并存回对象存储（thumbs/w640/<key>.webp），之后直接读存储。
 * 原图 key 带 uuid / 内容哈希、内容不变，所以缩略图同样可以长期缓存。
 */
import sharp from "sharp";
import { storage } from "@/lib/s3";
import { THUMB_WIDTHS } from "@/lib/thumb";
import { CACHE } from "./cache";

export const thumbKey = (key: string, w: number) => `thumbs/w${w}/${key}.webp`;

// 动图保留动画（输出动态 WebP）
const ANIMATED = /\.(gif|webp)$/i;

// 同时最多生成 2 张：一页几十张冷缩略图同时请求时不把 CPU / 内存打满
const MAX_RUNNING = 2;
let running = 0;
const waiting: (() => void)[] = [];
async function limited<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= MAX_RUNNING) await new Promise<void>((r) => waiting.push(r));
  else running++;
  try {
    return await fn();
  } finally {
    const next = waiting.shift();
    // 名额直接交给排队的下一个，否则归还
    if (next) next();
    else running--;
  }
}

// 同一张缩略图并发请求只生成一次
const inflight = new Map<string, Promise<Uint8Array | null>>();

async function generate(key: string, w: number): Promise<Uint8Array | null> {
  // 读原图也放进限流里：排队中的请求不占着整张原图的内存
  const out = await limited(async () => {
    const src = await storage.get(key);
    if (!src) return null;
    const input = new Uint8Array(await src.arrayBuffer());
    try {
      return await sharp(input, { animated: ANIMATED.test(key) })
        .autoOrient()
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
    } catch (e) {
      // 解码不了的格式（如 HEIC）：交给调用方回退原图
      console.warn(`[thumb] ${key} 无法缩放，回退原图:`, e);
      return null;
    }
  });
  if (!out) return null;
  await storage.put(thumbKey(key, w), out, "image/webp").catch((e) => {
    console.error(`[thumb] ${key} 缓存写入失败:`, e);
  });
  return out;
}

/**
 * 取缩略图；返回 null 表示该用原图（矢量图、原图不存在、解码失败）。
 * 存储出错照常抛出。
 */
export async function getThumb(key: string, w: number): Promise<Response | null> {
  if (/\.svg$/i.test(key)) return null;
  const tk = thumbKey(key, w);
  const headers = { "content-type": "image/webp", ...CACHE.immutable };

  const cached = await storage.get(tk);
  if (cached) return new Response(cached.body, { headers });

  let job = inflight.get(tk);
  if (!job) {
    job = generate(key, w).finally(() => inflight.delete(tk));
    inflight.set(tk, job);
  }
  const bytes = await job;
  return bytes ? new Response(bytes as BodyInit, { headers }) : null;
}

/** 删除原图时一并删掉各档缩略图 */
export async function deleteThumbs(key: string) {
  await Promise.all(THUMB_WIDTHS.map((w) => storage.delete(thumbKey(key, w))));
}
