import { post } from "@i/db";
import { ORPCError } from "@orpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { notFound, withDbErrors } from "../crud";
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

  update: adminProcedure
    .input(upsert.partial().extend({ id: z.string() }))
    .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      const [row] = await withDbErrors(() =>
        context.db
          .update(post)
          .set({ ...data, ...(data.status === "published" ? { publishedAt: new Date() } : {}) })
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
