import { z } from "zod";
import { publicProcedure, router } from "../trpc";

export const pageRouter = router({
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => ctx.db.page.findUnique({ where: { id: input.id } })),
});
