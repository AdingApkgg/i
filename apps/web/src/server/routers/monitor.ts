import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../trpc";

const upsert = z.object({
  name: z.string().min(1),
  target: z.string().min(1),
  kind: z.enum(["http", "tcp"]).default("http"),
  intervalSec: z.number().int().default(60),
  enabled: z.boolean().default(true),
});

export const monitorRouter = router({
  list: publicProcedure.query(({ ctx }) =>
    ctx.db.monitor.findMany({ orderBy: { createdAt: "desc" } }),
  ),

  create: adminProcedure.input(upsert).mutation(({ ctx, input }) =>
    ctx.db.monitor.create({ data: input }),
  ),

  update: adminProcedure
    .input(upsert.partial().extend({ id: z.string().min(1) }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.monitor.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.monitor.delete({ where: { id: input.id } })),

  /** Latest check per enabled target (populated by the background scheduler). */
  status: publicProcedure.query(async ({ ctx }) => {
    const monitors = await ctx.db.monitor.findMany({
      where: { enabled: true },
      orderBy: { createdAt: "desc" },
    });
    const rows = await Promise.all(
      monitors.map(async (m) => {
        const last = await ctx.db.monitorCheck.findFirst({
          where: { monitorId: m.id },
          orderBy: { checkedAt: "desc" },
        });
        return {
          id: m.id,
          name: m.name,
          target: m.target,
          kind: m.kind,
          ok: last?.ok ?? null,
          statusCode: last?.statusCode ?? null,
          latencyMs: last?.latencyMs ?? null,
          checkedAt: last?.checkedAt ?? null,
        };
      }),
    );
    return rows;
  }),
});
