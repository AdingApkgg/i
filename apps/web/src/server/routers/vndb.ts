import { z } from "zod";
import { adminProcedure } from "../orpc";
import { searchVndb } from "../vndb";
export const vndbRouter = {
  search: adminProcedure
    .input(z.object({ query: z.string().trim().min(1).max(120) }))
    .handler(({ input }) => searchVndb(input.query)),
};
