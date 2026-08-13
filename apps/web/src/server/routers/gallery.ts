import { z } from "zod";
import { withDbErrors } from "../crud";
import { adminProcedure, publicProcedure, router } from "../trpc";

/**
 * 相册：图集 (Album) + 照片 (Photo)。
 * 照片 CRUD 保持 list/create/update/delete 命名（dash 通用约定），
 * page 为游标分页瀑布流查询（albumId 过滤，null = 未分类）。
 * 图集自身的 CRUD 在 root 的 `albums` 键（crudRouter 通用工厂）。
 */

const bySort = [{ sortOrder: "asc" as const }, { createdAt: "desc" as const }];
// 游标分页要求排序完全确定，追加 id 兜底打破并列
const pageOrderBy = [...bySort, { id: "asc" as const }];

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

export const galleryRouter = router({
  // ---- 照片 ----
  list: publicProcedure.query(({ ctx }) =>
    ctx.db.photo.findMany({
      orderBy: bySort,
      include: { album: { select: { id: true, name: true } } },
    }),
  ),

  /**
   * 游标分页：cursor 传上一页最后一条的 id，多取一条探测有无下一页。
   * albumId：字符串 = 该图集；null = 未分类；不传 = 全部。
   * 已知限制：游标行在翻页间隙被删除时 Prisma 返回空页、分页提前终止（刷新即恢复）。
   */
  page: publicProcedure
    .input(
      z.object({
        cursor: z.string().nullish(),
        limit: z.number().int().min(1).max(100).default(24),
        albumId: z.string().nullish().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where = input.albumId === undefined ? {} : { albumId: input.albumId };
      const rows = await ctx.db.photo.findMany({
        where,
        orderBy: pageOrderBy,
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });
      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;
      const last = items[items.length - 1];
      return { items, nextCursor: hasMore && last ? last.id : null };
    }),

  create: adminProcedure
    .input(photoCreateSchema)
    .mutation(({ ctx, input }) => withDbErrors(() => ctx.db.photo.create({ data: input }))),

  update: adminProcedure.input(photoUpdateSchema).mutation(({ ctx, input }) => {
    const { id, ...data } = input;
    return withDbErrors(() => ctx.db.photo.update({ where: { id }, data }));
  }),

  delete: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .mutation(({ ctx, input }) =>
      withDbErrors(() => ctx.db.photo.delete({ where: { id: input.id } })),
    ),

  /** 批量移动照片到某图集（albumId null = 移出到未分类） */
  movePhotos: adminProcedure
    .input(
      z.object({ ids: z.array(z.string().min(1)).min(1), albumId: z.string().min(1).nullable() }),
    )
    .mutation(({ ctx, input }) =>
      withDbErrors(() =>
        ctx.db.photo.updateMany({
          where: { id: { in: input.ids } },
          data: { albumId: input.albumId },
        }),
      ),
    ),

  /** 批量删除照片 */
  deletePhotos: adminProcedure
    .input(z.object({ ids: z.array(z.string().min(1)).min(1) }))
    .mutation(({ ctx, input }) => ctx.db.photo.deleteMany({ where: { id: { in: input.ids } } })),

  // ---- 图集（公开读） ----
  /** 首页分区：全部图集（带张数 + 前 N 张预览）+ 未分类照片段 */
  albums: publicProcedure
    .input(z.object({ preview: z.number().int().min(1).max(24).default(8) }).optional())
    .query(async ({ ctx, input }) => {
      const preview = input?.preview ?? 8;
      const [albums, unassigned, unassignedCount] = await Promise.all([
        ctx.db.album.findMany({
          orderBy: bySort,
          include: {
            photos: { orderBy: bySort, take: preview },
            _count: { select: { photos: true } },
          },
        }),
        ctx.db.photo.findMany({ where: { albumId: null }, orderBy: bySort, take: preview }),
        ctx.db.photo.count({ where: { albumId: null } }),
      ]);
      return { albums, unassigned: { photos: unassigned, count: unassignedCount } };
    }),

  /** 图集详情页用：按名称取图集 + 张数 */
  albumByName: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .query(({ ctx, input }) =>
      ctx.db.album.findUnique({
        where: { name: input.name },
        include: { _count: { select: { photos: true } } },
      }),
    ),
});
