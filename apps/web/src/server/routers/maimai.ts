import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { syncMaimai } from "@/lib/maimai";
import { adminProcedure, publicProcedure, router } from "../trpc";

export const maimaiRouter = router({
  // ---- admin: config + sync ----
  config: adminProcedure.query(async ({ ctx }) => {
    const c = await ctx.db.maimaiConfig.findUnique({ where: { id: "current" } });
    return (
      c ?? {
        id: "current",
        source: "diving-fish",
        divingFishUsername: "",
        divingFishImportToken: "",
        lxnsPersonalToken: "",
      }
    );
  }),

  saveConfig: adminProcedure
    .input(
      z.object({
        source: z.enum(["diving-fish", "lxns"]),
        divingFishUsername: z.string().optional(),
        divingFishImportToken: z.string().optional(),
        lxnsPersonalToken: z.string().optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.maimaiConfig.upsert({
        where: { id: "current" },
        update: input,
        create: { id: "current", ...input },
      }),
    ),

  sync: adminProcedure.mutation(async () => {
    try {
      return await syncMaimai();
    } catch (e) {
      throw new TRPCError({ code: "BAD_REQUEST", message: (e as Error).message });
    }
  }),

  // ---- public: profile + b50 + all records ----
  profile: publicProcedure.query(({ ctx }) =>
    ctx.db.maimaiProfile.findUnique({ where: { id: "current" } }),
  ),

  b50: publicProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.maimaiRecord.findMany({
      where: { pool: { not: null } },
      orderBy: [{ pool: "asc" }, { boardOrder: "asc" }],
    });
    return {
      b35: rows.filter((r) => r.pool === "b35"),
      b15: rows.filter((r) => r.pool === "b15"),
    };
  }),

  records: publicProcedure
    .input(z.object({ q: z.string().optional(), limit: z.number().int().min(1).max(500).default(200) }).optional())
    .query(({ ctx, input }) =>
      ctx.db.maimaiRecord.findMany({
        where: input?.q ? { title: { contains: input.q, mode: "insensitive" } } : undefined,
        orderBy: [{ achievements: "desc" }],
        take: input?.limit ?? 200,
      }),
    ),
});
