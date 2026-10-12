import { ORPCError } from "@orpc/server";
import { z } from "zod";
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
      context.db.post.findMany({
        where: input?.includeDrafts ? {} : { status: "published" },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      }),
    ),

  bySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .handler(async ({ context, input }) => {
      const post = await context.db.post.findUnique({ where: { slug: input.slug } });
      if (!post) throw new ORPCError("NOT_FOUND");
      return post;
    }),

  create: adminProcedure.input(upsert).handler(({ context, input }) =>
    context.db.post.create({
      data: {
        ...input,
        publishedAt: input.status === "published" ? new Date() : null,
      },
    }),
  ),

  update: adminProcedure
    .input(upsert.partial().extend({ id: z.string() }))
    .handler(({ context, input }) => {
      const { id, ...data } = input;
      return context.db.post.update({
        where: { id },
        data: {
          ...data,
          ...(data.status === "published" ? { publishedAt: new Date() } : {}),
        },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .handler(({ context, input }) => context.db.post.delete({ where: { id: input.id } })),
};
