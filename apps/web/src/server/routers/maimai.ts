import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { syncMaimai } from "@/lib/maimai";
import { adminProcedure, publicProcedure } from "../orpc";

export const maimaiRouter = {
  // ---- admin: config + sync ----
  config: adminProcedure.handler(async ({ context }) => {
    const c = await context.db.maimaiConfig.findUnique({ where: { id: "current" } });
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
    .handler(({ context, input }) =>
      context.db.maimaiConfig.upsert({
        where: { id: "current" },
        update: input,
        create: { id: "current", ...input },
      }),
    ),

  sync: adminProcedure.handler(async () => {
    try {
      return await syncMaimai();
    } catch (e) {
      throw new ORPCError("BAD_REQUEST", { message: (e as Error).message });
    }
  }),

  // ---- public: profile + b50 + all records ----
  profile: publicProcedure.handler(({ context }) =>
    context.db.maimaiProfile.findUnique({ where: { id: "current" } }),
  ),

  b50: publicProcedure.handler(async ({ context }) => {
    const rows = await context.db.maimaiRecord.findMany({
      where: { pool: { not: null } },
      orderBy: [{ pool: "asc" }, { boardOrder: "asc" }],
    });
    return {
      b35: rows.filter((r) => r.pool === "b35"),
      b15: rows.filter((r) => r.pool === "b15"),
    };
  }),

  records: publicProcedure
    .input(
      z
        .object({ q: z.string().optional(), limit: z.number().int().min(1).max(500).default(200) })
        .optional(),
    )
    .handler(({ context, input }) =>
      context.db.maimaiRecord.findMany({
        where: input?.q ? { title: { contains: input.q, mode: "insensitive" } } : undefined,
        orderBy: [{ achievements: "desc" }],
        take: input?.limit ?? 200,
      }),
    ),
};
