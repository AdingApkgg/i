import { z } from "zod";
import { bgmClient } from "../bgm";
import { adminProcedure } from "../orpc";
export const bgmRouter = {
  search: adminProcedure
    .input(z.object({ query: z.string().trim().min(1).max(120) }))
    .handler(({ input }) => bgmClient.search(input.query)),
  detail: adminProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .handler(({ input }) => bgmClient.fetchOne(input.id)),
};
