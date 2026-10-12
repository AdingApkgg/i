import { page } from "@i/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { publicProcedure } from "../orpc";

export const pageRouter = {
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .handler(
      async ({ context, input }) =>
        (await context.db.query.page.findFirst({ where: eq(page.id, input.id) })) ?? null,
    ),
};
