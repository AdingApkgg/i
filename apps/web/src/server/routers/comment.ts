import { comment } from "@i/db";
import { ORPCError } from "@orpc/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { isAdminRole } from "@/lib/roles";
import { commentBodySchema } from "@/lib/schemas";
import type { Context } from "../orpc";
import { protectedProcedure, publicProcedure } from "../orpc";

const withUser = { user: { columns: { id: true, name: true, image: true } } } as const;

const byId = (db: Context["db"], id: string) =>
  db.query.comment.findFirst({ where: eq(comment.id, id), with: withUser });

export const commentRouter = {
  list: publicProcedure.input(z.object({ path: z.string() })).handler(({ context, input }) =>
    context.db.query.comment.findMany({
      where: and(eq(comment.path, input.path), eq(comment.status, "visible")),
      orderBy: asc(comment.createdAt),
      with: withUser,
    }),
  ),

  create: protectedProcedure
    .input(
      commentBodySchema.extend({
        path: z.string().min(1),
        postId: z.string().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const [row] = await context.db
        .insert(comment)
        .values({
          path: input.path,
          contentMd: input.contentMd,
          postId: input.postId ?? null,
          userId: context.user.id,
        })
        .returning({ id: comment.id });
      // 带上作者信息，和 list 的形状一致（前端乐观更新直接用）
      return (await byId(context.db, row!.id))!;
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .handler(async ({ context, input }) => {
      const c = await context.db.query.comment.findFirst({ where: eq(comment.id, input.id) });
      if (!c) throw new ORPCError("NOT_FOUND");
      if (c.userId !== context.user.id && !isAdminRole(context.user)) {
        throw new ORPCError("FORBIDDEN");
      }
      const [row] = await context.db.delete(comment).where(eq(comment.id, input.id)).returning();
      return row!;
    }),
};
