import type { Db } from "@i/db";
import { bangumiAccount, bangumiEntry, bangumiRun } from "@i/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { sameState } from "@/lib/bangumi/merge";
import type { AnimeMetadata, CollectionState } from "@/lib/bangumi/types";

export const stateSchema = z.object({
  type: z.number().int().min(1).max(5),
  rate: z.number().int().min(0).max(10),
  comment: z.string().max(10000),
  private: z.boolean(),
  episodes: z.record(z.string().regex(/^[1-9]\d*$/), z.number().int().min(0).max(3)),
});
export type Entry = typeof bangumiEntry.$inferSelect;
export type Run = typeof bangumiRun.$inferSelect;
export type Store = Db | Parameters<Parameters<Db["transaction"]>[0]>[0];
export interface PlanEntry {
  subjectId: number;
  metadata: AnimeMetadata;
  base: CollectionState | null;
  local: CollectionState | null;
  remote: CollectionState | null;
  revision: number | null;
  paused: boolean;
  uncertain: boolean;
}
export interface PreviewData {
  accountId: number;
  entries: PlanEntry[];
  revisions: Record<string, number>;
}
export const getEntries = (db: Store) =>
  db.select().from(bangumiEntry).orderBy(bangumiEntry.subjectId);
export async function getAccount(db: Store) {
  return (await db.select().from(bangumiAccount).where(eq(bangumiAccount.id, "current")))[0];
}
export async function getRun(db: Store, id: string) {
  const row = (await db.select().from(bangumiRun).where(eq(bangumiRun.id, id)))[0];
  if (!row) throw new Error("同步记录不存在");
  return row;
}
export function previewData(data: unknown): PreviewData {
  if (
    !data ||
    typeof data !== "object" ||
    !("accountId" in data) ||
    !("entries" in data) ||
    !("revisions" in data) ||
    !Array.isArray(data.entries)
  )
    throw new Error("预览数据不可用，请重新演练");
  return data as PreviewData;
}
export async function bindAccount(db: Db, who: { id: number; username: string }) {
  await db.transaction(async (tx) => {
    await tx.insert(bangumiAccount).values({ id: "current" }).onConflictDoNothing();
    const [account] = await tx
      .select()
      .from(bangumiAccount)
      .where(eq(bangumiAccount.id, "current"))
      .for("update");
    if (account!.userId !== null && account!.userId !== who.id)
      throw new Error("Token 所属账号与已绑定账号不同，已停止同步");
    await tx
      .update(bangumiAccount)
      .set({ userId: who.id, username: who.username })
      .where(eq(bangumiAccount.id, "current"));
  });
}
/** 15 分钟执行上限后留一分钟退出余量，进程重启也能从后台恢复。 */
export async function recoverExpired(db: Db) {
  await db.transaction(async (tx) => {
    const [account] = await tx
      .select()
      .from(bangumiAccount)
      .where(eq(bangumiAccount.id, "current"))
      .for("update");
    if (
      !account?.activeRunId ||
      !account.activeSince ||
      Date.now() - account.activeSince.getTime() < 16 * 60 * 1000
    )
      return;
    const message = "上次任务中断或超时，请重新演练";
    await tx
      .update(bangumiRun)
      .set({ status: "error", error: message, progress: message, finishedAt: new Date() })
      .where(and(eq(bangumiRun.id, account.activeRunId), eq(bangumiRun.status, "running")));
    await tx
      .update(bangumiAccount)
      .set({ activeRunId: null, activeSince: null, lastError: message })
      .where(eq(bangumiAccount.id, "current"));
  });
}
export async function assertEditable(tx: Store) {
  const [account] = await tx
    .select()
    .from(bangumiAccount)
    .where(eq(bangumiAccount.id, "current"))
    .for("update");
  if (account?.activeRunId && (await getRun(tx, account.activeRunId)).kind === "apply")
    throw new Error("正在应用已确认预览，请稍后编辑或新增");
}
export async function claim(db: Db, kind: string, data: unknown = null) {
  return db.transaction(async (tx) => {
    const [account] = await tx
      .select()
      .from(bangumiAccount)
      .where(eq(bangumiAccount.id, "current"))
      .for("update");
    if (!account) throw new Error("请先连接 Bangumi");
    if (account.activeRunId) {
      if (!account.activeSince || Date.now() - account.activeSince.getTime() < 16 * 60 * 1000)
        throw new Error("已有同步任务运行中，请稍后再试");
      await tx
        .update(bangumiRun)
        .set({ status: "error", error: "上次任务中断或超时，请重新演练", finishedAt: new Date() })
        .where(and(eq(bangumiRun.id, account.activeRunId), eq(bangumiRun.status, "running")));
    }
    const [run] = await tx
      .insert(bangumiRun)
      .values({ kind, data, expiresAt: new Date(Date.now() + 30 * 60 * 1000) })
      .returning();
    await tx
      .update(bangumiAccount)
      .set({
        activeRunId: run!.id,
        activeSince: new Date(),
        lastError: null,
        ...(kind !== "preview" ? { lastAttemptAt: new Date() } : {}),
      })
      .where(eq(bangumiAccount.id, "current"));
    return run!;
  });
}
export async function assertOwner(db: Store, run: Run) {
  if (Date.now() - run.createdAt.getTime() > 15 * 60 * 1000)
    throw new Error("同步超时，请重新演练");
  if ((await getAccount(db))?.activeRunId !== run.id) throw new Error("同步任务已失效，请重新演练");
}
export async function finish(
  db: Db,
  run: Run,
  status: string,
  error: string | null = null,
  data?: unknown,
) {
  const [result] = await db
    .update(bangumiRun)
    .set({
      status,
      error,
      progress:
        status === "ready"
          ? "演练完成，尚未应用"
          : status === "success"
            ? "同步完成"
            : (error ?? "同步失败"),
      finishedAt: new Date(),
      ...(data === undefined ? {} : { data }),
    })
    .where(eq(bangumiRun.id, run.id))
    .returning();
  await db
    .update(bangumiAccount)
    .set({
      activeRunId: null,
      activeSince: null,
      lastError: error,
      ...(status === "success" ? { lastSyncedAt: new Date() } : {}),
    })
    .where(and(eq(bangumiAccount.id, "current"), eq(bangumiAccount.activeRunId, run.id)));
  return result!;
}
export function identicalRemote(expected: CollectionState | null, actual: CollectionState | null) {
  if (!sameState(expected, actual)) throw new Error("Bangumi 数据已变化，请重新演练");
}
