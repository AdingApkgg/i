/**
 * 后台媒体库：直接管对象存储里的全部文件（原图 / 视频 / 音频 / 附件），
 * 列出、预览、查引用、上传、替换、删除，并单独暴露「无人引用」的孤儿。
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
  Photo: `"title"`,
  Album: `"name"`,
  Post: `"title"`,
  Page: `"title"`,
  Comment: `"contentMd"`,
  Moment: `"content"::text`,
  Track: `"title"`,
  Movie: `"title"`,
  Vn: `"title"`,
  Device: `"name"`,
  Touhou: `"title"`,
  Friend: `"name"`,
  User: `"name"`,
};

/** 引用来源点进去的后台页；没有专属页的表给 null */
const HREF: Record<string, string | null> = {
  Photo: "/dash/gallery",
  Album: "/dash/albums",
  Post: "/dash/blog",
  Page: "/dash/pages",
  Comment: null,
  Moment: "/dash/moments",
  Track: "/dash/music",
  Movie: "/dash/movie",
  Vn: "/dash/vn",
  Device: "/dash/device",
  Touhou: "/dash/touhou",
  Friend: "/dash/friends",
  User: null,
};

/** node-postgres 用 rowCount，PGlite 用 affectedRows */
const affected = (res: { rowCount?: number | null; affectedRows?: number }) =>
  res.rowCount ?? res.affectedRows ?? 0;

const KEY_RE = /\/api\/gallery\/files\/([^"'\s()?#\\]+)/g;

export interface Ref {
  table: string;
  id: string;
  label: string;
  href: string | null;
}

/** 一次扫完全库引用：key → 引用来源。正文里的每处出现都算一次引用。 */
async function collectRefs(db: Context["db"]) {
  const parts = TARGETS.map(([table, column, json]) => {
    const text = json ? `"${column}"::text` : `"${column}"`;
    const label = LABELS[table] ?? "''";
    return sql`select ${sql.raw(`'${table}'`)} as src, "id" as id, left(coalesce(${sql.raw(label)}, ''), 60) as label, ${sql.raw(text)} as text from ${sql.raw(`"${table}"`)} where position(${STORED} in ${sql.raw(text)}) > 0`;
  });
  const res = await db.execute<{ src: string; id: string; label: string; text: string }>(
    sql.join(parts, sql` union all `),
  );

  const map = new Map<string, Ref[]>();
  for (const row of res.rows) {
    for (const m of row.text.matchAll(KEY_RE)) {
      const key = m[1]!;
      const list = map.get(key) ?? [];
      if (list.some((r) => r.table === row.src && r.id === row.id)) continue;
      list.push({
        table: row.src,
        id: row.id,
        label: row.label?.trim() || row.id.slice(0, 8),
        href: HREF[row.src] ?? null,
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

/** 逐项列原图；`thumbs/` 下的派生缩略图不单独成项 */
async function* listObjects() {
  for await (const obj of storage.list()) {
    if (obj.key.startsWith("thumbs/")) continue;
    if (obj.key.includes("/")) continue;
    yield obj;
  }
}

const PAGE = 60;

export const mediaRouter = {
  stats: adminProcedure.handler(async ({ context }) => {
    const refs = await collectRefs(context.db);
    let files = 0;
    let bytes = 0;
    let orphans = 0;
    let orphanBytes = 0;
    for await (const obj of listObjects()) {
      files++;
      bytes += obj.size;
      if (!refs.has(obj.key)) {
        orphans++;
        orphanBytes += obj.size;
      }
    }
    return { files, bytes, orphans, orphanBytes };
  }),

  list: adminProcedure
    .input(
      z.object({
        type: z.enum(["image", "video", "audio", "other"]).optional(),
        usage: z.enum(["all", "used", "orphan"]).default("all"),
        q: z.string().trim().optional(),
        cursor: z.string().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const refs = await collectRefs(context.db);
      const needle = input.q?.toLowerCase();
      const items: {
        key: string;
        size: number;
        type: MediaType;
        used: boolean;
        refs: Ref[];
      }[] = [];
      let next: string | undefined;
      let started = !input.cursor;

      for await (const obj of listObjects()) {
        if (!started) {
          if (obj.key === input.cursor) started = true;
          continue;
        }
        const type = mediaType(obj.key);
        if (input.type && type !== input.type) continue;
        if (needle && !obj.key.toLowerCase().includes(needle)) continue;
        const used = refs.has(obj.key);
        if (input.usage === "used" && !used) continue;
        if (input.usage === "orphan" && used) continue;
        if (items.length === PAGE) {
          next = items[items.length - 1]!.key;
          break;
        }
        items.push({ key: obj.key, size: obj.size, type, used, refs: refs.get(obj.key) ?? [] });
      }
      return { items, next };
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

export type { MediaType };
