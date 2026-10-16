import { masturbationDay } from "@i/db";
import { ORPCError } from "@orpc/server";
import { and, asc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { dailyDateSchema, dailyYearSchema, todayInShanghai } from "@/lib/daily-record";
import { adminProcedure, publicProcedure } from "../orpc";

const dayInput = z.object({ date: dailyDateSchema });
function validPastDay(date: string) {
  if (date > todayInShanghai()) throw new ORPCError("BAD_REQUEST", { message: "不能记录未来日期" });
}
export const dailyRecordRouter = {
  year: publicProcedure
    .input(z.object({ year: dailyYearSchema }))
    .handler(async ({ context, input }) => ({
      year: input.year,
      today: todayInShanghai(),
      days: await context.db
        .select({ date: masturbationDay.date, count: masturbationDay.count })
        .from(masturbationDay)
        .where(
          and(
            gte(masturbationDay.date, `${input.year}-01-01`),
            lte(masturbationDay.date, `${input.year}-12-31`),
          ),
        )
        .orderBy(asc(masturbationDay.date)),
    })),
  save: adminProcedure
    .input(dayInput.extend({ count: z.number().int().min(0).max(1000) }))
    .handler(async ({ context, input }) => {
      validPastDay(input.date);
      if (input.count === 0)
        await context.db.delete(masturbationDay).where(eq(masturbationDay.date, input.date));
      else
        await context.db
          .insert(masturbationDay)
          .values(input)
          .onConflictDoUpdate({ target: masturbationDay.date, set: { count: input.count } });
      return input;
    }),
  increment: adminProcedure.input(dayInput).handler(async ({ context, input }) => {
    validPastDay(input.date);
    const [row] = await context.db
      .insert(masturbationDay)
      .values({ date: input.date, count: 1 })
      .onConflictDoUpdate({
        target: masturbationDay.date,
        set: { count: sql`${masturbationDay.count} + 1` },
        setWhere: lt(masturbationDay.count, 1000),
      })
      .returning({ date: masturbationDay.date, count: masturbationDay.count });
    if (!row) throw new ORPCError("BAD_REQUEST", { message: "当日次数已达到输入上限" });
    return row;
  }),
};
