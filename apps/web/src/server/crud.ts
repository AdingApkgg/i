import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { Context } from "./trpc";
import { adminProcedure, publicProcedure, router } from "./trpc";

/**
 * 把 Prisma 约束错误翻译成语义化的 TRPCError（否则一律 500，dash 只见「保存失败」）。
 * P2002 唯一约束冲突 / P2003 外键目标不存在 / P2025 记录不存在。
 */
export async function withDbErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2002") throw new TRPCError({ code: "CONFLICT", message: "已存在同名记录" });
    if (code === "P2003")
      throw new TRPCError({ code: "BAD_REQUEST", message: "关联的记录不存在（可能已被删除）" });
    if (code === "P2025") throw new TRPCError({ code: "NOT_FOUND", message: "记录不存在" });
    throw e;
  }
}

/**
 * A Prisma model delegate (db.track, db.movie, …), narrowed to the CRUD verbs
 * the factory needs. `TRow` is inferred from the delegate so `list`/`byId`
 * return properly-typed rows to the callers.
 */
// biome-ignore-start lint/suspicious/noExplicitAny: Prisma delegate args are structurally complex
interface Delegate<TRow> {
  findMany: (args?: any) => Promise<TRow[]>;
  findUnique: (args: any) => Promise<TRow | null>;
  create: (args: any) => Promise<TRow>;
  update: (args: any) => Promise<TRow>;
  delete: (args: any) => Promise<TRow>;
}
// biome-ignore-end lint/suspicious/noExplicitAny: see above

const idSchema = z.object({ id: z.string().min(1) });

const pageSchema = z.object({
  cursor: z.string().nullish(),
  limit: z.number().int().min(1).max(100).default(24),
});

/** update 输入里 ZodDefault/ZodPrefault 解包后的 shape 类型 */
type StrippedShape<TShape extends z.ZodRawShape> = {
  [K in keyof TShape]: TShape[K] extends z.ZodDefault<infer Inner extends z.ZodType>
    ? Inner
    : TShape[K] extends z.ZodPrefault<infer Inner extends z.ZodType>
      ? Inner
      : TShape[K];
};

/**
 * zod v4 的 .partial() 不会摘掉 .default()/.prefault()：解析 update 输入时，
 * 缺省的字段会被重新注入默认值（如 status/sortOrder），把没动过的列悄悄重置。
 * 先解开顶层的 Default/Prefault 包装再 .partial()，缺省字段才真正保持 undefined。
 */
function stripDefaults<TShape extends z.ZodRawShape>(schema: z.ZodObject<TShape>) {
  const shape: Record<string, z.core.$ZodType> = {};
  for (const [key, field] of Object.entries(schema.shape)) {
    shape[key] =
      field instanceof z.ZodDefault || field instanceof z.ZodPrefault ? field.unwrap() : field;
  }
  return z.object(shape) as z.ZodObject<StrippedShape<TShape>>;
}

/**
 * Standard CRUD router for a per-domain table:
 *   list/byId            → public reads
 *   create/update/delete → admin only (role admin|owner)
 */
export function crudRouter<TShape extends z.ZodRawShape, TRow>(opts: {
  model: (db: Context["db"]) => Delegate<TRow>;
  createSchema: z.ZodObject<TShape>;
  orderBy?: unknown;
}) {
  const { model, createSchema } = opts;
  const orderBy = opts.orderBy ?? { createdAt: "desc" };
  const updateSchema = stripDefaults(createSchema)
    .partial()
    .extend({ id: z.string().min(1) });
  // 游标分页要求排序完全确定，追加 id 兜底打破 sortOrder/createdAt 的并列
  const pageOrderBy = [...(Array.isArray(orderBy) ? orderBy : [orderBy]), { id: "asc" }];

  return router({
    list: publicProcedure.query(({ ctx }) => model(ctx.db).findMany({ orderBy })),

    /**
     * 游标分页版 list：cursor 传上一页最后一条的 id，多取一条探测有无下一页。
     * 已知限制：游标行若在翻页间隙被删除，Prisma 会返回空页、分页提前终止
     * （刷新即恢复）；个人站删除频率低，不为此上 WHERE 键集分页的复杂度。
     */
    page: publicProcedure.input(pageSchema).query(async ({ ctx, input }) => {
      const rows = await model(ctx.db).findMany({
        orderBy: pageOrderBy,
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });
      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;
      const last = items[items.length - 1] as { id: string } | undefined;
      return { items, nextCursor: hasMore && last ? last.id : null };
    }),

    byId: publicProcedure
      .input(idSchema)
      .query(({ ctx, input }) => model(ctx.db).findUnique({ where: { id: input.id } })),

    create: adminProcedure
      .input(createSchema)
      .mutation(({ ctx, input }) => withDbErrors(() => model(ctx.db).create({ data: input }))),

    update: adminProcedure.input(updateSchema).mutation(({ ctx, input }) => {
      const { id, ...data } = input as { id: string } & Record<string, unknown>;
      return withDbErrors(() => model(ctx.db).update({ where: { id }, data }));
    }),

    delete: adminProcedure
      .input(idSchema)
      .mutation(({ ctx, input }) =>
        withDbErrors(() => model(ctx.db).delete({ where: { id: input.id } })),
      ),
  });
}
