/**
 * 后台媒体库：直接管对象存储里的全部文件（原图 / 视频 / 音频 / 附件），
 * 列出、排序、按体积收窄、预览、查引用、上传、替换、删除，并单独暴露「无人引用」的孤儿。
 *
 * CAS 下同一份内容只有一个 key，可能被多处引用，所以删除前统一走引用检查：
 * 有引用默认保留（force 才删），删掉时连它派生的各档缩略图一起清。
 */
import { sql } from "drizzle-orm";
import { z } from "zod";
import { storage } from "@/lib/s3";
import { STORED } from "@/lib/thumb";
import type { Context } from "../orpc";
import { adminProcedure } from "../orpc";
import { deleteThumbs } from "../thumbs";

/** 可能出现站内地址的列：[表, 列, jsonb] */
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

/** 每张表给引用来源用的可读标签列（都没有就退回 id 前 8 位） */
const LABELS: Record<string, string> = {
  Photo: `"t"."title"`,
  Album: `"t"."name"`,
  Post: `"t"."title"`,
  Page: `"t"."title"`,
  Comment: `"t"."contentMd"`,
  Moment: `"t"."content"::text`,
  Track: `"t"."title"`,
  Movie: `"t"."title"`,
  Vn: `"t"."title"`,
  Device: `"t"."name"`,
  Touhou: `"t"."title"`,
  Friend: `"t"."name"`,
  User: `"t"."name"`,
};

/** 引用来源在人话里的表名 */
const SOURCE: Record<string, string> = {
  Photo: "相册照片",
  Album: "相册",
  Post: "文章",
  Page: "页面",
  Comment: "评论",
  Moment: "动态",
  Track: "音乐",
  Movie: "影片",
  Vn: "游戏",
  Device: "设备",
  Touhou: "东方",
  Friend: "友链",
  User: "用户",
};

/** 引用来源点进去的后台页；没有专属页的表给 null（评论另按所属文章生成） */
const HREF: Record<string, string | null> = {
  Photo: "/dash/gallery",
  Album: "/dash/gallery",
  Post: "/dash/blog",
  Page: "/dash/pages",
  Comment: null,
  Moment: "/dash/home",
  Track: "/dash/domain",
  Movie: "/dash/anime",
  Vn: "/dash/anime",
  Device: "/dash/domain",
  Touhou: "/dash/anime",
  Friend: "/dash/friends",
  User: null,
};

/** node-postgres 用 rowCount，PGlite 用 affectedRows */
const affected = (res: { rowCount?: number | null; affectedRows?: number }) =>
  res.rowCount ?? res.affectedRows ?? 0;

const KEY_RE = /\/api\/gallery\/files\/([^"'\s()?#\\]+)/g;

export interface Ref {
  table: string;
  source: string;
  id: string;
  label: string;
  href: string | null;
}

/** 一次扫完全库引用：key → 引用来源。正文里的每处出现都算一次引用。 */
async function collectRefs(db: Context["db"]) {
  const parts = TARGETS.map(([table, column, json]) => {
    const text = json ? `"t"."${column}"::text` : `"t"."${column}"`;
    const label = LABELS[table] ?? "''";
    // 评论多带一列所属文章 slug，引用来源才能直接点进正文
    const extra =
      table === "Comment"
        ? sql`left(coalesce("p"."slug", ''), 80) as slug from ${sql.raw(`"${table}"`)} "t" left join "Post" "p" on "p"."id" = "t"."postId"`
        : sql`'' as slug from ${sql.raw(`"${table}"`)} "t"`;
    return sql`select ${sql.raw(`'${table}'`)} as src, "t"."id" as id, left(coalesce(${sql.raw(label)}, ''), 60) as label, ${sql.raw(text)} as text, ${extra} where position(${STORED} in ${sql.raw(text)}) > 0`;
  });
  const res = await db.execute<{
    src: string;
    id: string;
    label: string;
    text: string;
    slug: string;
  }>(sql.join(parts, sql` union all `));

  const map = new Map<string, Ref[]>();
  for (const row of res.rows) {
    for (const m of row.text.matchAll(KEY_RE)) {
      const key = m[1]!;
      const list = map.get(key) ?? [];
      if (list.some((r) => r.table === row.src && r.id === row.id)) continue;
      list.push({
        table: row.src,
        source: SOURCE[row.src] ?? row.src,
        id: row.id,
        label: row.label?.trim() || row.id.slice(0, 8),
        href:
          row.src === "Comment" ? (row.slug ? `/blog/${row.slug}` : null) : (HREF[row.src] ?? null),
      });
      map.set(key, list);
    }
  }
  return map;
}

const TYPE_BY_EXT: Record<string, MediaType> = {
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  gif: "image",
  avif: "image",
  svg: "image",
  mp4: "video",
  webm: "video",
  mov: "video",
  m4v: "video",
  mp3: "audio",
  m4a: "audio",
  flac: "audio",
  wav: "audio",
  ogg: "audio",
};
type MediaType = "image" | "video" | "audio" | "other";
const mediaType = (key: string): MediaType =>
  TYPE_BY_EXT[key.split(".").pop()?.toLowerCase() ?? ""] ?? "other";

type Obj = { key: string; size: number; lastModified: string; type: MediaType };

/** 逐项列原图；`thumbs/` 下的派生缩略图不单独成项 */
async function* listObjects() {
  for await (const obj of storage.list()) {
    if (obj.key.startsWith("thumbs/")) continue;
    if (obj.key.includes("/")) continue;
    yield { ...obj, type: mediaType(obj.key) };
  }
}

const PAGE = 60;

const SORTS = {
  newest: (a: Obj, b: Obj) => b.lastModified.localeCompare(a.lastModified),
  oldest: (a: Obj, b: Obj) => a.lastModified.localeCompare(b.lastModified),
  largest: (a: Obj, b: Obj) => b.size - a.size,
  smallest: (a: Obj, b: Obj) => a.size - b.size,
  key: (a: Obj, b: Obj) => a.key.localeCompare(b.key),
};
type Sort = keyof typeof SORTS | "refs";

/** 体积分档（上限，字节）；最后一档兜底 */
const BUCKETS = [
  { label: "≤100 KB", max: 100_000 },
  { label: "≤1 MB", max: 1_000_000 },
  { label: "≤10 MB", max: 10_000_000 },
  { label: ">10 MB", max: Number.POSITIVE_INFINITY },
];

export const mediaRouter = {
  stats: adminProcedure.handler(async ({ context }) => {
    const refs = await collectRefs(context.db);
    const byType: Record<MediaType, number> = { image: 0, video: 0, audio: 0, other: 0 };
    const all: { key: string; size: number; type: MediaType }[] = [];
    // 体积分档，给统计图用
    const buckets = BUCKETS.map((b) => ({ label: b.label, n: 0 }));
    let files = 0;
    let bytes = 0;
    let orphans = 0;
    let orphanBytes = 0;
    for await (const obj of listObjects()) {
      files++;
      bytes += obj.size;
      byType[obj.type]++;
      const bi = BUCKETS.findIndex((b) => obj.size <= b.max);
      buckets[bi < 0 ? buckets.length - 1 : bi]!.n++;
      all.push({ key: obj.key, size: obj.size, type: obj.type });
      if (!refs.has(obj.key)) {
        orphans++;
        orphanBytes += obj.size;
      }
    }
    all.sort((a, b) => b.size - a.size);
    return { files, bytes, orphans, orphanBytes, byType, buckets, largest: all.slice(0, 5) };
  }),

  list: adminProcedure
    .input(
      z.object({
        type: z.enum(["image", "video", "audio", "other"]).optional(),
        usage: z.enum(["all", "used", "orphan"]).default("all"),
        sort: z.enum(["newest", "oldest", "largest", "smallest", "refs", "key"]).default("newest"),
        q: z.string().trim().optional(),
        minBytes: z.number().int().min(0).optional(),
        offset: z.number().int().min(0).default(0),
      }),
    )
    .handler(async ({ context, input }) => {
      const refs = await collectRefs(context.db);
      const needle = input.q?.toLowerCase();
      const matched: (Obj & { used: boolean; refs: Ref[] })[] = [];

      for await (const obj of listObjects()) {
        if (input.type && obj.type !== input.type) continue;
        if (input.minBytes && obj.size < input.minBytes) continue;
        const list = refs.get(obj.key) ?? [];
        const used = list.length > 0;
        if (input.usage === "used" && !used) continue;
        if (input.usage === "orphan" && used) continue;
        // 关键字同时匹配对象 key 与引用来源标题，方便「按出处找图」
        if (
          needle &&
          !obj.key.toLowerCase().includes(needle) &&
          !list.some(
            (r) =>
              r.label.toLowerCase().includes(needle) || r.source.toLowerCase().includes(needle),
          )
        ) {
          continue;
        }
        matched.push({ ...obj, used, refs: list });
      }

      if (input.sort === "refs") {
        matched.sort((a, b) => b.refs.length - a.refs.length || b.size - a.size);
      } else {
        matched.sort(SORTS[input.sort as keyof typeof SORTS]);
      }

      const items = matched.slice(input.offset, input.offset + PAGE).map((o) => ({
        key: o.key,
        size: o.size,
        type: o.type,
        lastModified: o.lastModified,
        used: o.used,
        refs: o.refs,
      }));
      const next = input.offset + PAGE < matched.length ? input.offset + PAGE : undefined;
      return { items, next, total: matched.length };
    }),

  detail: adminProcedure
    .input(z.object({ key: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const obj = await storage.head(input.key);
      if (!obj) return null;
      const refs = await collectRefs(context.db);
      return {
        key: input.key,
        size: obj.size,
        type: mediaType(input.key),
        url: `${STORED}${input.key}`,
        refs: refs.get(input.key) ?? [],
      };
    }),

  /** 删除：有引用默认保留，force 时连引用一起断掉直接删 */
  remove: adminProcedure
    .input(z.object({ keys: z.array(z.string().min(1)).min(1), force: z.boolean().default(false) }))
    .handler(async ({ context, input }) => {
      const refs = input.force ? null : await collectRefs(context.db);
      const deleted: string[] = [];
      const kept: string[] = [];
      for (const key of new Set(input.keys)) {
        if (refs?.has(key)) {
          kept.push(key);
          continue;
        }
        if (!(await storage.head(key))) continue;
        await storage.delete(key);
        await deleteThumbs(key);
        deleted.push(key);
      }
      return { deleted, kept };
    }),

  /** 替换：把旧 key 的全部引用改成新 key，再删掉旧文件 */
  replace: adminProcedure
    .input(z.object({ key: z.string().min(1), newKey: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      if (input.key === input.newKey) return { updated: 0 };
      if (!(await storage.head(input.newKey))) throw new Error("新文件不存在");
      const from = STORED + input.key;
      const to = STORED + input.newKey;
      let updated = 0;
      for (const [table, column, json] of TARGETS) {
        const text = sql.raw(json ? `"${column}"::text` : `"${column}"`);
        const set = sql`replace(${text}, ${from}, ${to})${json ? sql.raw("::jsonb") : sql``}`;
        const res = await context.db.execute(
          sql`update ${sql.raw(`"${table}"`)} set ${sql.raw(`"${column}"`)} = ${set} where position(${from} in ${text}) > 0`,
        );
        updated += affected(res);
      }
      // 旧对象此时已无引用，连缩略图一起清掉
      await storage.delete(input.key);
      await deleteThumbs(input.key);
      return { updated };
    }),
};

export type { MediaType, Sort };
