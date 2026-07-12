import { z } from "zod";
import type { Context } from "./trpc";
import { adminProcedure, publicProcedure, router } from "./trpc";

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
  const updateSchema = createSchema.partial().extend({ id: z.string().min(1) });

  return router({
    list: publicProcedure.query(({ ctx }) => model(ctx.db).findMany({ orderBy })),

    byId: publicProcedure
      .input(idSchema)
      .query(({ ctx, input }) => model(ctx.db).findUnique({ where: { id: input.id } })),

    create: adminProcedure
      .input(createSchema)
      .mutation(({ ctx, input }) => model(ctx.db).create({ data: input })),

    update: adminProcedure.input(updateSchema).mutation(({ ctx, input }) => {
      const { id, ...data } = input as { id: string } & Record<string, unknown>;
      return model(ctx.db).update({ where: { id }, data });
    }),

    delete: adminProcedure
      .input(idSchema)
      .mutation(({ ctx, input }) => model(ctx.db).delete({ where: { id: input.id } })),
  });
}
