/**
 * 回收对象存储里不再被引用的文件（原图 + 各档缩略图）。
 *
 * 同一个文件可能被多处引用：图集封面默认就是第一张照片，导入的旧文章正文和相册也共用同一批图片。
 * 所以删记录之后逐个检查全库，确实没有任何地方再引用才真正删除；检查或删除失败只记日志，
 * 不影响已经完成的数据库操作（最坏留下孤儿文件，不会删掉还在用的图）。
 */
import {
  album,
  comment,
  friend,
  moment,
  movie,
  page,
  photo,
  post,
  touhou,
  track,
  user,
  vn,
} from "@i/db";
import { type AnyColumn, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { storage } from "@/lib/s3";
import { STORED } from "@/lib/thumb";
import type { Context } from "./orpc";
import { escapeLike } from "./sql";
import { deleteThumbs } from "./thumbs";

/** 可能出现站内图片地址的列（链接字段 + 会内嵌图片的正文）；jsonb 正文按文本匹配 */
const REFERENCES: [PgTable, AnyColumn][] = [
  [photo, photo.imageUrl],
  [photo, photo.thumbUrl],
  [album, album.coverUrl],
  [post, post.coverUrl],
  [post, post.contentMd],
  [post, post.content],
  [page, page.contentMd],
  [page, page.content],
  [comment, comment.contentMd],
  [moment, moment.content],
  [track, track.coverUrl],
  [movie, movie.coverUrl],
  [vn, vn.coverUrl],
  [touhou, touhou.coverUrl],
  [friend, friend.avatarUrl],
  [user, user.image],
];

/**
 * /api/gallery/files/<key>[?w=…] → 地址里的 key 原文（不解码：引用检查要按库里存的写法搜）；
 * 不是站内存储的地址返回 null
 */
export function storedKey(url: string | null | undefined): string | null {
  if (!url?.startsWith(STORED)) return null;
  const key = url.slice(STORED.length).split(/[?#]/)[0]!;
  return key && !key.includes("/") ? key : null;
}

/** 地址里的 key → 存储里的 key（%xx 解码；不合法的编码原样用） */
function objectKey(raw: string) {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

async function isReferenced(db: Context["db"], raw: string) {
  const pattern = `%${escapeLike(STORED + raw)}%`;
  const checks = REFERENCES.map(
    ([table, col]) => sql`exists (select 1 from ${table} where ${col}::text like ${pattern})`,
  );
  const res = await db.execute<{ used: boolean }>(
    sql`select (${sql.join(checks, sql` or `)}) as used`,
  );
  return res.rows[0]?.used === true;
}

/**
 * 在删除 / 改动记录之后调用：传入这些记录原来用到的图片地址，
 * 已无引用的站内文件连同缩略图一起删掉。返回实际删除的 key。
 */
export async function releaseStoredFiles(
  db: Context["db"],
  urls: (string | null | undefined)[],
): Promise<string[]> {
  const raws = [...new Set(urls.map(storedKey).filter((k): k is string => k !== null))];
  const released: string[] = [];
  // 逐个处理：每个 key 的引用检查要扫多张表，批量删几百张时并发会占满连接池
  for (const raw of raws) {
    const key = objectKey(raw);
    try {
      if (await isReferenced(db, raw)) continue;
      await storage.delete(key);
      await deleteThumbs(key);
      released.push(key);
    } catch (e) {
      console.error(`[storage] 回收 ${key} 失败:`, e);
    }
  }
  return released;
}
