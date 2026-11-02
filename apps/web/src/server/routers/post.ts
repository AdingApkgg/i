import { post } from "@i/db";
import { ORPCError } from "@orpc/server";
import { desc, eq, getTableColumns } from "drizzle-orm";
import { z } from "zod";
import { excerptOf } from "@/lib/content/text";
import type { RichDoc } from "@/lib/content/types";
import { assertValidDoc } from "@/lib/content/validate.server";
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
  // 正文：Tiptap JSON，按 lib/content 的 schema 校验
  content: z.custom<RichDoc>(
    (v) => {
      try {
        assertValidDoc(v);
        return true;
      } catch {
        return false;
      }
    },
    { message: "正文格式不对" },
  ),
  coverUrl: z.string().optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum(["draft", "published"]).default("draft"),
});

// 公开列表不带正文：loader 数据会整个序列化进 HTML，列表页用不到正文
const { contentMd: _contentMd, content: _content, ...summaryColumns } = getTableColumns(post);

/** 没填摘要时从正文截一段 */
const withExcerpt = <T extends { excerpt?: string; content?: RichDoc }>(data: T): T =>
  data.content && !data.excerpt?.trim() ? { ...data, excerpt: excerptOf(data.content) } : data;
const newestFirst = [desc(post.publishedAt), desc(post.createdAt)];

export const postRouter = {
  /** 公开：已发布文章的摘要列表；includeDrafts（后台用）只对管理员生效，含草稿（同样不带正文，编辑时用 byId 取） */
  list: publicProcedure
    .input(z.object({ includeDrafts: z.boolean().default(false) }).optional())
    .handler(({ context, input }) => {
      if (input?.includeDrafts) {
        if (!isAdminRole(context.user)) throw new ORPCError("FORBIDDEN");
        return context.db
          .select(summaryColumns)
          .from(post)
          .orderBy(...newestFirst);
      }
      return context.db
        .select(summaryColumns)
        .from(post)
        .where(eq(post.status, "published"))
        .orderBy(...newestFirst);
    }),

  /** 后台编辑：按 id 取完整记录（含草稿和正文） */
  byId: adminProcedure.input(z.object({ id: z.string() })).handler(async ({ context, input }) => {
    const row = await context.db.query.post.findFirst({ where: eq(post.id, input.id) });
    return row ?? notFound();
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
        .values({
          ...withExcerpt(input),
          publishedAt: input.status === "published" ? new Date() : null,
        })
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
          .set({ ...withExcerpt(data), publishedAt })
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
