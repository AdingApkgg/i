import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../trpc";

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

export const postRouter = router({
  list: publicProcedure
    .input(z.object({ includeDrafts: z.boolean().default(false) }).optional())
    .query(({ ctx, input }) =>
      ctx.db.post.findMany({
        where: input?.includeDrafts ? {} : { status: "published" },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      }),
    ),

  bySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ ctx, input }) => {
    const post = await ctx.db.post.findUnique({ where: { slug: input.slug } });
    if (!post) throw new TRPCError({ code: "NOT_FOUND" });
    return post;
  }),

  create: adminProcedure.input(upsert).mutation(({ ctx, input }) =>
    ctx.db.post.create({
      data: {
        ...input,
        publishedAt: input.status === "published" ? new Date() : null,
      },
    }),
  ),

  update: adminProcedure
    .input(upsert.partial().extend({ id: z.string() }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.post.update({
        where: { id },
        data: {
          ...data,
          ...(data.status === "published" ? { publishedAt: new Date() } : {}),
        },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) => ctx.db.post.delete({ where: { id: input.id } })),
});
