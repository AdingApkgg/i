import { z } from "zod";
import { publicProcedure } from "../orpc";

export const pageRouter = {
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .handler(({ context, input }) => context.db.page.findUnique({ where: { id: input.id } })),
};
