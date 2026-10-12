import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure } from "../orpc";

const withUser = { user: { select: { id: true, name: true, image: true } } };

export const commentRouter = {
  list: publicProcedure.input(z.object({ path: z.string() })).handler(({ context, input }) =>
    context.db.comment.findMany({
      where: { path: input.path, status: "visible" },
      orderBy: { createdAt: "asc" },
      include: withUser,
    }),
  ),

  create: protectedProcedure
    .input(
      z.object({
        path: z.string().min(1),
        contentMd: z.string().min(1).max(2000),
        postId: z.string().optional(),
      }),
    )
    .handler(({ context, input }) =>
      context.db.comment.create({
        data: {
          path: input.path,
          contentMd: input.contentMd,
          postId: input.postId ?? null,
          userId: context.user.id,
        },
        include: withUser,
      }),
    ),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ context, input }) => {
      const c = await context.db.comment.findUnique({ where: { id: input.id } });
      if (!c) throw new ORPCError("NOT_FOUND");
      const role = (context.user as { role?: string }).role;
      if (c.userId !== context.user.id && role !== "admin" && role !== "owner") {
        throw new ORPCError("FORBIDDEN");
      }
      return context.db.comment.delete({ where: { id: input.id } });
    }),
};
