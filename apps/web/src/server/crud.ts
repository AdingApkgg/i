import { PG, pgErrorCode } from "@i/db";
import { ORPCError } from "@orpc/server";
import { eq, getTableColumns } from "drizzle-orm";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import { z } from "zod";
import { adminProcedure, publicProcedure } from "./orpc";
import { after, cursorValues, type OrderSpec, orderBy } from "./pagination";

/**
 * 把 Postgres 约束错误翻译成语义化的 ORPCError（否则一律 500，dash 只见「保存失败」）。
 * 23505 唯一约束冲突 / 23503 外键目标不存在。
 */
export async function withDbErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    const code = pgErrorCode(e);
    if (code === PG.uniqueViolation) throw new ORPCError("CONFLICT", { message: "已存在同名记录" });
    if (code === PG.foreignKeyViolation)
      throw new ORPCError("BAD_REQUEST", { message: "关联的记录不存在（可能已被删除）" });
    throw e;
  }
}

/** update / delete 命中 0 行（id 不存在）时抛出。 */
export function notFound(): never {
  throw new ORPCError("NOT_FOUND", { message: "记录不存在" });
}

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

/** 走通用 CRUD 的表：必须有字符串主键 id。 */
type CrudTable = PgTable & { id: PgColumn };

/**
 * Standard CRUD router for a per-domain table:
 *   list/byId/page       → public reads
 *   create/update/delete → admin only (role admin|owner)
 */
export function crudRouter<TTable extends CrudTable, TShape extends z.ZodRawShape>(opts: {
  table: TTable;
  createSchema: z.ZodObject<TShape>;
  /** 排序（不含 id）；缺省 createdAt desc */
  order?: OrderSpec;
}) {
  const { table, createSchema } = opts;
  type Row = TTable["$inferSelect"];
  const columns = getTableColumns(table) as Record<string, PgColumn>;
  const order: OrderSpec = opts.order ?? [[columns.createdAt!, "desc"]];
  // 游标分页要求排序完全确定，追加 id 兜底打破 sortOrder/createdAt 的并列
  const pageOrder: OrderSpec = [...order, [table.id, "asc"]];
  const updateSchema = stripDefaults(createSchema)
    .partial()
    .extend({ id: z.string().min(1) });

  // 泛型表在 drizzle 的 builder 上推不出具体类型，统一在这里收窄
  // biome-ignore lint/suspicious/noExplicitAny: see above
  const t = table as any;

  return {
    list: publicProcedure.handler(
      ({ context }) =>
        context.db
          .select()
          .from(t)
          .orderBy(...orderBy(order)) as Promise<Row[]>,
    ),

    /**
     * 游标分页版 list：cursor 传上一页最后一条的 id，按游标行的排序键做键集分页，
     * 多取一条探测有无下一页。游标行若在翻页间隙被删除则返回空页（刷新即恢复）。
     */
    page: publicProcedure.input(pageSchema).handler(async ({ context, input }) => {
      let where: ReturnType<typeof after> | undefined;
      if (input.cursor) {
        const [cur] = await context.db.select().from(t).where(eq(table.id, input.cursor)).limit(1);
        if (!cur) return { items: [] as Row[], nextCursor: null };
        where = after(pageOrder, cursorValues(columns, pageOrder, cur));
      }
      const rows = (await context.db
        .select()
        .from(t)
        .where(where)
        .orderBy(...orderBy(pageOrder))
        .limit(input.limit + 1)) as Row[];
      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;
      const last = items[items.length - 1] as { id: string } | undefined;
      return { items, nextCursor: hasMore && last ? last.id : null };
    }),

    byId: publicProcedure.input(idSchema).handler(async ({ context, input }) => {
      const [row] = await context.db.select().from(t).where(eq(table.id, input.id)).limit(1);
      return (row ?? null) as Row | null;
    }),

    create: adminProcedure.input(createSchema).handler(async ({ context, input }) => {
      const [row] = (await withDbErrors(() =>
        context.db.insert(t).values(input).returning(),
      )) as Row[];
      return row!;
    }),

    update: adminProcedure.input(updateSchema).handler(async ({ context, input }) => {
      const { id, ...data } = input as { id: string } & Record<string, unknown>;
      const [row] = (await withDbErrors(() =>
        context.db.update(t).set(data).where(eq(table.id, id)).returning(),
      )) as Row[];
      return row ?? notFound();
    }),

    delete: adminProcedure.input(idSchema).handler(async ({ context, input }) => {
      const [row] = (await context.db.delete(t).where(eq(table.id, input.id)).returning()) as Row[];
      return row ?? notFound();
    }),
  };
}
