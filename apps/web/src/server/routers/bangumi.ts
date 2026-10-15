import { bangumiAccount, bangumiEntry, bangumiRun } from "@i/db";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import {
  bindAccount,
  getAccount,
  getEntries,
  getRun,
  recoverExpired,
  stateSchema,
} from "../bangumi/repository";
import { bangumiClient, wakeBangumi } from "../bangumi/scheduler";
import {
  addEntry,
  confirmPreview,
  createPreview,
  saveEntry,
  synchronize,
} from "../bangumi/service";
import { adminProcedure, publicProcedure } from "../orpc";

const subjectId = z.number().int().positive();
async function handle<T>(work: () => Promise<T>) {
  try {
    return await work();
  } catch (error) {
    throw new ORPCError("BAD_REQUEST", {
      message: error instanceof Error ? error.message : "Bangumi 同步失败",
    });
  }
}
export const bangumiRouter = {
  publicList: publicProcedure.handler(async ({ context }) => {
    const entries = await context.db
      .select({
        subjectId: bangumiEntry.subjectId,
        metadata: bangumiEntry.metadata,
        state: bangumiEntry.state,
      })
      .from(bangumiEntry)
      .where(
        and(
          sql`${bangumiEntry.state}->>'private' = 'false'`,
          isNotNull(bangumiEntry.baseline),
          eq(bangumiEntry.writeUncertain, false),
        ),
      )
      .orderBy(desc(bangumiEntry.updatedAt));
    return entries.map((e) => ({
      subjectId: e.subjectId,
      ...e.metadata,
      type: e.state.type,
      rate: e.state.rate,
      comment: e.state.comment,
      watched: Object.values(e.state.episodes).filter((type) => type === 2).length,
    }));
  }),
  status: adminProcedure.handler(async ({ context }) => {
    await recoverExpired(context.db);
    return {
      configured: !!process.env.BANGUMI_ACCESS_TOKEN?.trim(),
      account: (await getAccount(context.db)) ?? null,
      runs: await context.db
        .select({
          id: bangumiRun.id,
          kind: bangumiRun.kind,
          status: bangumiRun.status,
          progress: bangumiRun.progress,
          error: bangumiRun.error,
          createdAt: bangumiRun.createdAt,
        })
        .from(bangumiRun)
        .orderBy(desc(bangumiRun.createdAt))
        .limit(10),
    };
  }),
  list: adminProcedure.handler(({ context }) => getEntries(context.db)),
  run: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(({ context, input }) => handle(() => getRun(context.db, input.id))),
  add: adminProcedure.input(z.object({ subjectId })).handler(({ context, input }) =>
    handle(async () => {
      const row = await addEntry(context.db, bangumiClient(), input.subjectId);
      void wakeBangumi(context.db, true).catch(() => {});
      return row;
    }),
  ),
  update: adminProcedure
    .input(z.object({ subjectId, revision: z.number().int().nonnegative(), state: stateSchema }))
    .handler(({ context, input }) =>
      handle(async () => {
        const row = await saveEntry(context.db, input.subjectId, input.revision, input.state);
        void wakeBangumi(context.db, true).catch(() => {});
        return row;
      }),
    ),
  preview: adminProcedure.handler(({ context }) =>
    handle(() => createPreview(context.db, bangumiClient(), true)),
  ),
  apply: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        choices: z
          .record(z.string(), z.record(z.string(), z.enum(["local", "remote"])))
          .default({}),
      }),
    )
    .handler(({ context, input }) =>
      handle(() => confirmPreview(context.db, bangumiClient(), input.id, input.choices, true)),
    ),
  sync: adminProcedure.handler(({ context }) =>
    handle(() => synchronize(context.db, bangumiClient(), true)),
  ),
  settings: adminProcedure
    .input(z.object({ autoSync: z.boolean() }))
    .handler(({ context, input }) =>
      handle(async () => {
        if (input.autoSync) {
          const client = bangumiClient();
          await bindAccount(context.db, await client.me());
          if (!(await getAccount(context.db))?.initialized)
            throw new Error("请先演练预览并确认首次同步");
        }
        await context.db.update(bangumiAccount).set(input).where(eq(bangumiAccount.id, "current"));
        return { autoSync: input.autoSync };
      }),
    ),
};
