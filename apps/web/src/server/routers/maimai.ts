import { maimaiConfig, maimaiProfile, maimaiRecord } from "@i/db";
import { ORPCError } from "@orpc/server";
import { asc, desc, eq, ilike, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { syncMaimai } from "@/lib/maimai";
import { adminProcedure, publicProcedure } from "../orpc";

/** LIKE 通配符转义（Prisma 的 contains 会自动转义，这里手动保持同样语义）。 */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export const maimaiRouter = {
  // ---- admin: config + sync ----
  config: adminProcedure.handler(async ({ context }) => {
    const c = await context.db.query.maimaiConfig.findFirst({
      where: eq(maimaiConfig.id, "current"),
    });
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
    .handler(async ({ context, input }) => {
      const [row] = await context.db
        .insert(maimaiConfig)
        .values({ id: "current", ...input })
        .onConflictDoUpdate({ target: maimaiConfig.id, set: input })
        .returning();
      return row!;
    }),

  sync: adminProcedure.handler(async () => {
    try {
      return await syncMaimai();
    } catch (e) {
      throw new ORPCError("BAD_REQUEST", { message: (e as Error).message });
    }
  }),

  // ---- public: profile + b50 + all records ----
  profile: publicProcedure.handler(
    async ({ context }) =>
      (await context.db.query.maimaiProfile.findFirst({
        where: eq(maimaiProfile.id, "current"),
      })) ?? null,
  ),

  b50: publicProcedure.handler(async ({ context }) => {
    const rows = await context.db
      .select()
      .from(maimaiRecord)
      .where(isNotNull(maimaiRecord.pool))
      .orderBy(asc(maimaiRecord.pool), asc(maimaiRecord.boardOrder));
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
      context.db
        .select()
        .from(maimaiRecord)
        .where(input?.q ? ilike(maimaiRecord.title, `%${escapeLike(input.q)}%`) : undefined)
        .orderBy(desc(maimaiRecord.achievements))
        .limit(input?.limit ?? 200),
    ),
};
