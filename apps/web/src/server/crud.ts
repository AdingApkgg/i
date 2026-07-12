import { z } from "zod";
import type { Context } from "./trpc";
import { adminProcedure, publicProcedure, router } from "./trpc";

/**
 * A Prisma model delegate (db.track, db.movie, …). Typed as a loose record of
 * async methods because Prisma's generated delegate types don't structurally
 * unify — the factory only needs the standard CRUD verbs.
 */
// biome-ignore lint/suspicious/noExplicitAny: Prisma delegates don't structurally unify
type Delegate = Record<"findMany" | "findUnique" | "create" | "update" | "delete", (args?: any) => Promise<any>>;

const idSchema = z.object({ id: z.string().min(1) });

/**
 * Build a standard CRUD router for a per-domain table:
 *   list/byId            → public reads
 *   create/update/delete → admin only (role admin|owner)
 *
 * `model` selects the Prisma delegate from ctx.db (e.g. `(db) => db.track`).
 * `createSchema` is a Zod object; update takes the same fields partially + id.
 */
export function crudRouter<TShape extends z.ZodRawShape>(opts: {
  model: (db: Context["db"]) => Delegate;
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
