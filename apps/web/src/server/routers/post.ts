import { post } from "@i/db";
import { ORPCError } from "@orpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { notFound, stripDefaults, withDbErrors } from "../crud";
import { adminProcedure, publicProcedure } from "../orpc";

const upsert = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, "slug 只能是小写字母、数字、连字符"),
  title: z.string().min(1),
  excerpt: z.string().optional(),
  contentMd: z.string().min(1),
  coverUrl: z.string().optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum(["draft", "published"]).default("draft"),
});

export const postRouter = {
  list: publicProcedure
    .input(z.object({ includeDrafts: z.boolean().default(false) }).optional())
    .handler(({ context, input }) =>
      context.db
        .select()
        .from(post)
        .where(input?.includeDrafts ? undefined : eq(post.status, "published"))
        .orderBy(desc(post.publishedAt), desc(post.createdAt)),
    ),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .handler(async ({ context, input }) => {
      const row = await context.db.query.post.findFirst({ where: eq(post.slug, input.slug) });
      if (!row) throw new ORPCError("NOT_FOUND");
      return row;
    }),

  create: adminProcedure.input(upsert).handler(async ({ context, input }) => {
    const [row] = await withDbErrors(() =>
      context.db
        .insert(post)
        .values({ ...input, publishedAt: input.status === "published" ? new Date() : null })
        .returning(),
    );
    return row!;
  }),

  // stripDefaults：后台编辑表单不带 tags，不能让 .default([]) 把标签清空；
  // 没带 status 时也不能被打回 draft
  update: adminProcedure
    .input(stripDefaults(upsert).partial().extend({ id: z.string() }))
    .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      const cur = await context.db.query.post.findFirst({
        where: eq(post.id, id),
        columns: { publishedAt: true },
      });
      if (!cur) notFound();
      // 只在首次发布时记发布时间；已发布的文章再保存保留原日期（含旧博客导入的日期）
      const publishedAt = data.status === "published" && !cur.publishedAt ? new Date() : undefined;
      const [row] = await withDbErrors(() =>
        context.db
          .update(post)
          .set({ ...data, publishedAt })
          .where(eq(post.id, id))
          .returning(),
      );
      return row ?? notFound();
    }),

  delete: adminProcedure.input(z.object({ id: z.string() })).handler(async ({ context, input }) => {
    const [row] = await context.db.delete(post).where(eq(post.id, input.id)).returning();
    return row ?? notFound();
  }),
};
