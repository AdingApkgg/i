import { z } from "zod";
import { adminProcedure, publicProcedure } from "../orpc";

const upsert = z.object({
  name: z.string().min(1),
  target: z.string().min(1),
  kind: z.enum(["http", "tcp"]).default("http"),
  intervalSec: z.number().int().default(60),
  enabled: z.boolean().default(true),
});

export const monitorRouter = {
  list: publicProcedure.handler(({ context }) =>
    context.db.monitor.findMany({ orderBy: { createdAt: "desc" } }),
  ),

  create: adminProcedure
    .input(upsert)
    .handler(({ context, input }) => context.db.monitor.create({ data: input })),

  update: adminProcedure
    .input(upsert.partial().extend({ id: z.string().min(1) }))
    .handler(({ context, input }) => {
      const { id, ...data } = input;
      return context.db.monitor.update({ where: { id }, data });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .handler(({ context, input }) => context.db.monitor.delete({ where: { id: input.id } })),

  /** Latest check per enabled target (populated by the background scheduler). */
  status: publicProcedure.handler(async ({ context }) => {
    const monitors = await context.db.monitor.findMany({
      where: { enabled: true },
      orderBy: { createdAt: "desc" },
    });
    const rows = await Promise.all(
      monitors.map(async (m) => {
        const last = await context.db.monitorCheck.findFirst({
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
};
