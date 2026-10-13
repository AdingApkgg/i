import { album, photo } from "@i/db";
import { and, count, eq, getTableColumns, inArray, isNull, type SQL } from "drizzle-orm";
import { z } from "zod";
import { notFound, withDbErrors } from "../crud";
import { adminProcedure, publicProcedure } from "../orpc";
import { after, cursorValues, type OrderSpec, orderBy } from "../pagination";
import { releaseStoredFiles } from "../stored-files";

/**
 * 相册：图集 (Album) + 照片 (Photo)。
 * 照片 CRUD 保持 list/create/update/delete 命名（dash 通用约定），
 * page 为游标分页瀑布流查询（albumId 过滤，null = 未分类）。
 * 图集自身的 CRUD 在 root 的 `albums` 键（crudRouter 通用工厂）。
 * 删除照片 / 换图后，不再被任何地方引用的站内图片（原图 + 缩略图）会从对象存储里一并删掉。
 */

const photoOrder: OrderSpec = [
  [photo.sortOrder, "asc"],
  [photo.createdAt, "desc"],
];
// 游标分页要求排序完全确定，追加 id 兜底打破并列
const photoPageOrder: OrderSpec = [...photoOrder, [photo.id, "asc"]];
const albumOrder: OrderSpec = [
  [album.sortOrder, "asc"],
  [album.createdAt, "desc"],
];

// dash 表单把清空的数字输入发成 null，nullish→0 兜底（.default 只吃 undefined）
const sortOrder = z
  .number()
  .int()
  .nullish()
  .transform((v) => v ?? 0);

const photoCreateSchema = z.object({
  title: z.string().default(""),
  imageUrl: z.string().min(1),
  thumbUrl: z.string().optional(),
  description: z.string().optional(),
  takenAt: z.string().optional(),
  sortOrder,
  albumId: z.string().min(1).nullish(),
});

// update 手写（缺省字段保持 undefined 不动原值；清空排序视为归零）
const photoUpdateSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  imageUrl: z.string().min(1).optional(),
  thumbUrl: z.string().nullish(),
  description: z.string().nullish(),
  takenAt: z.string().nullish(),
  sortOrder: sortOrder.optional(),
  albumId: z.string().min(1).nullish(),
});

/** albumId：字符串 = 该图集；null = 未分类；undefined = 全部。 */
const byAlbum = (albumId: string | null | undefined): SQL | undefined =>
  albumId === undefined
    ? undefined
    : albumId === null
      ? isNull(photo.albumId)
      : eq(photo.albumId, albumId);

export const galleryRouter = {
  // ---- 照片 ----
  list: publicProcedure.handler(({ context }) =>
    context.db.query.photo.findMany({
      orderBy: orderBy(photoOrder),
      with: { album: { columns: { id: true, name: true } } },
    }),
  ),

  /**
   * 游标分页：cursor 传上一页最后一条的 id，按游标行的排序键做键集分页，多取一条探测有无下一页。
   * albumId：字符串 = 该图集；null = 未分类；不传 = 全部。
   * 游标行在翻页间隙被删除时返回空页（刷新即恢复）。
   */
  page: publicProcedure
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(100).default(24),
        albumId: z.string().nullish().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      let cursorWhere: SQL | undefined;
      if (input.cursor) {
        const [cur] = await context.db.select().from(photo).where(eq(photo.id, input.cursor));
        if (!cur) return { items: [], nextCursor: null };
        cursorWhere = after(
          photoPageOrder,
          cursorValues(getTableColumns(photo), photoPageOrder, cur),
        );
      }
      const rows = await context.db
        .select()
        .from(photo)
        .where(and(byAlbum(input.albumId), cursorWhere))
        .orderBy(...orderBy(photoPageOrder))
        .limit(input.limit + 1);
      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;
      const last = items[items.length - 1];
      return { items, nextCursor: hasMore && last ? last.id : null };
    }),

  create: adminProcedure.input(photoCreateSchema).handler(async ({ context, input }) => {
    const [row] = await withDbErrors(() => context.db.insert(photo).values(input).returning());
    return row!;
  }),

  update: adminProcedure.input(photoUpdateSchema).handler(async ({ context, input }) => {
    const { id, ...data } = input;
    const [before] = await context.db
      .select({ imageUrl: photo.imageUrl, thumbUrl: photo.thumbUrl })
      .from(photo)
      .where(eq(photo.id, id));
    const [row] = await withDbErrors(() =>
      context.db.update(photo).set(data).where(eq(photo.id, id)).returning(),
    );
    if (!row) return notFound();
    // 换了图：旧文件没人用了就回收（没换的不查）
    if (before) {
      const replaced = [before.imageUrl, before.thumbUrl].filter(
        (u) => u && u !== row.imageUrl && u !== row.thumbUrl,
      );
      if (replaced.length) await releaseStoredFiles(context.db, replaced);
    }
    return row;
  }),

  delete: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const [row] = await context.db.delete(photo).where(eq(photo.id, input.id)).returning();
      if (!row) return notFound();
      await releaseStoredFiles(context.db, [row.imageUrl, row.thumbUrl]);
      return row;
    }),

  /** 批量移动照片到某图集（albumId null = 移出到未分类） */
  movePhotos: adminProcedure
    .input(
      z.object({ ids: z.array(z.string().min(1)).min(1), albumId: z.string().min(1).nullable() }),
    )
    .handler(async ({ context, input }) => {
      const rows = await withDbErrors(() =>
        context.db
          .update(photo)
          .set({ albumId: input.albumId })
          .where(inArray(photo.id, input.ids))
          .returning({ id: photo.id }),
      );
      return { count: rows.length };
    }),

  /** 批量删除照片 */
  deletePhotos: adminProcedure
    .input(z.object({ ids: z.array(z.string().min(1)).min(1) }))
    .handler(async ({ context, input }) => {
      const rows = await context.db
        .delete(photo)
        .where(inArray(photo.id, input.ids))
        .returning({ id: photo.id, imageUrl: photo.imageUrl, thumbUrl: photo.thumbUrl });
      await releaseStoredFiles(
        context.db,
        rows.flatMap((r) => [r.imageUrl, r.thumbUrl]),
      );
      return { count: rows.length };
    }),

  // ---- 图集（公开读） ----
  /** 首页分区：全部图集（带张数 + 前 N 张预览）+ 未分类照片段 */
  albums: publicProcedure
    .input(z.object({ preview: z.number().int().min(1).max(24).default(8) }).optional())
    .handler(async ({ context, input }) => {
      const preview = input?.preview ?? 8;
      const [albums, counts, unassigned] = await Promise.all([
        context.db.query.album.findMany({
          orderBy: orderBy(albumOrder),
          with: { photos: { orderBy: orderBy(photoOrder), limit: preview } },
        }),
        // 每个图集的张数（含 albumId 为空的「未分类」）
        context.db
          .select({ albumId: photo.albumId, n: count() })
          .from(photo)
          .groupBy(photo.albumId),
        context.db
          .select()
          .from(photo)
          .where(isNull(photo.albumId))
          .orderBy(...orderBy(photoOrder))
          .limit(preview),
      ]);
      const countOf = new Map(counts.map((c) => [c.albumId, c.n]));
      return {
        albums: albums.map((a) => ({ ...a, _count: { photos: countOf.get(a.id) ?? 0 } })),
        unassigned: { photos: unassigned, count: countOf.get(null) ?? 0 },
      };
    }),

  /** 图集详情页用：按名称取图集 + 张数 */
  albumByName: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const a = await context.db.query.album.findFirst({ where: eq(album.name, input.name) });
      if (!a) return null;
      const photos = await context.db.$count(photo, eq(photo.albumId, a.id));
      return { ...a, _count: { photos } };
    }),
};
