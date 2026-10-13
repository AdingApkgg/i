import { post } from "@i/db";
import { ORPCError } from "@orpc/server";
import { desc, eq, getTableColumns } from "drizzle-orm";
import { z } from "zod";
import { isAdminRole } from "@/lib/roles";
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

// 公开列表不带正文：loader 数据会整个序列化进 HTML，列表页用不到正文
const { contentMd: _contentMd, ...summaryColumns } = getTableColumns(post);
const newestFirst = [desc(post.publishedAt), desc(post.createdAt)];

export const postRouter = {
  /** 公开：已发布文章的摘要列表；includeDrafts（后台用）只对管理员生效，返回含草稿的完整记录 */
  list: publicProcedure
    .input(z.object({ includeDrafts: z.boolean().default(false) }).optional())
    .handler(({ context, input }) => {
      if (input?.includeDrafts) {
        if (!isAdminRole(context.user)) throw new ORPCError("FORBIDDEN");
        return context.db
          .select()
          .from(post)
          .orderBy(...newestFirst);
      }
      return context.db
        .select(summaryColumns)
        .from(post)
        .where(eq(post.status, "published"))
        .orderBy(...newestFirst);
    }),

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
