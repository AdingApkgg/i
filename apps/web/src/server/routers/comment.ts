import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../trpc";

const withUser = { user: { select: { id: true, name: true, image: true } } };

export const commentRouter = router({
  list: publicProcedure.input(z.object({ path: z.string() })).query(({ ctx, input }) =>
    ctx.db.comment.findMany({
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
    .mutation(({ ctx, input }) =>
      ctx.db.comment.create({
        data: {
          path: input.path,
          contentMd: input.contentMd,
          postId: input.postId ?? null,
          userId: ctx.user.id,
        },
        include: withUser,
      }),
    ),

  remove: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    const c = await ctx.db.comment.findUnique({ where: { id: input.id } });
    if (!c) throw new TRPCError({ code: "NOT_FOUND" });
    const role = (ctx.user as { role?: string }).role;
    if (c.userId !== ctx.user.id && role !== "admin" && role !== "owner") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return ctx.db.comment.delete({ where: { id: input.id } });
  }),
});
