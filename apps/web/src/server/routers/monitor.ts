import { monitor, monitorCheck } from "@i/db";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { notFound, stripDefaults } from "../crud";
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
    context.db.select().from(monitor).orderBy(desc(monitor.createdAt)),
  ),

  create: adminProcedure.input(upsert).handler(async ({ context, input }) => {
    const [row] = await context.db.insert(monitor).values(input).returning();
    return row!;
  }),

  update: adminProcedure
    // stripDefaults：部分更新不能把 enabled/kind/intervalSec 悄悄重置成默认值
    .input(
      stripDefaults(upsert)
        .partial()
        .extend({ id: z.string().min(1) }),
    )
    .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      const [row] = await context.db
        .update(monitor)
        .set(data)
        .where(eq(monitor.id, id))
        .returning();
      return row ?? notFound();
    }),

  delete: adminProcedure.input(z.object({ id: z.string() })).handler(async ({ context, input }) => {
    const [row] = await context.db.delete(monitor).where(eq(monitor.id, input.id)).returning();
    return row ?? notFound();
  }),

  /** Latest check per enabled target (populated by the background scheduler). */
  status: publicProcedure.handler(async ({ context }) => {
    const monitors = await context.db
      .select()
      .from(monitor)
      .where(eq(monitor.enabled, true))
      .orderBy(desc(monitor.createdAt));
    return Promise.all(
      monitors.map(async (m) => {
        const last = await context.db.query.monitorCheck.findFirst({
          where: eq(monitorCheck.monitorId, m.id),
          orderBy: desc(monitorCheck.checkedAt),
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
  }),
};
