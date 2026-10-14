import { page } from "@i/db";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import type { RichDoc } from "@/lib/content/types";
import { assertValidDoc } from "@/lib/content/validate.server";
import { notFound } from "../crud";
import { adminProcedure, publicProcedure } from "../orpc";

const richDoc = z.custom<RichDoc>(
  (v) => {
    try {
      assertValidDoc(v);
      return true;
    } catch {
      return false;
    }
  },
  { message: "正文格式不对" },
);

export const pageRouter = {
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .handler(
      async ({ context, input }) =>
        (await context.db.query.page.findFirst({ where: eq(page.id, input.id) })) ?? null,
    ),

  /** 后台：整页列表（不带正文） */
  list: adminProcedure.handler(({ context }) =>
    context.db
      .select({ id: page.id, title: page.title, updatedAt: page.updatedAt })
      .from(page)
      .orderBy(asc(page.id)),
  ),

  /** 后台：保存整页正文 */
  update: adminProcedure
    .input(z.object({ id: z.string(), title: z.string().min(1).optional(), content: richDoc }))
    .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      const [row] = await context.db.update(page).set(data).where(eq(page.id, id)).returning();
      return row ?? notFound();
    }),
};
