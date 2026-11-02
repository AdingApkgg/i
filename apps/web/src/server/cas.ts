/**
 * 内容寻址存储（CAS）：对象 key 由文件内容的 SHA-256 决定，同内容只存一份。
 *
 * 相册、文章配图、封面共用同一个桶，同一张图被上传两次（复制粘贴、多设备重传、
 * 从旧站搬运同一个文件）会落到同一个 key，不再堆出多份字节；地址因此可以长期缓存。
 * 删除仍然走 stored-files 的引用检查：同一 key 可能被多处引用，没人用才真正删。
 */
import { createHash } from "node:crypto";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

/** 内容 + 扩展名 → 对象 key（64 位小写十六进制 + 扩展名） */
export function casKey(bytes: Uint8Array, ext: string) {
  return `${createHash("sha256").update(bytes).digest("hex")}.${ext}`;
}

/** 扩展名：先看 MIME，再看文件名后缀，都不认识记 bin */
export function extFor(type: string, name: string) {
  const fromName = name
    .split(".")
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return EXT[type] ?? (fromName || "bin");
}

/** 存一份内容；已有同内容对象时直接复用，不重复写 */
export async function storeCas(
  store: {
    head(key: string): Promise<unknown>;
    put(key: string, body: Uint8Array, type: string): Promise<unknown>;
  },
  bytes: Uint8Array,
  meta: { type: string; name: string },
): Promise<{ key: string; deduped: boolean }> {
  const key = casKey(bytes, extFor(meta.type, meta.name));
  if (await store.head(key)) return { key, deduped: true };
  await store.put(key, bytes, meta.type || "application/octet-stream");
  return { key, deduped: false };
}
