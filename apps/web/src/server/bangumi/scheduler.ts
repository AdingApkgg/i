import { bangumiEntry, db } from "@i/db";
import { and, eq } from "drizzle-orm";
import { BangumiClient } from "@/lib/bangumi/api.server";
import { getAccount, recoverExpired } from "./repository";
import { synchronize } from "./service";
export function bangumiClient() {
  return new BangumiClient(process.env.BANGUMI_ACCESS_TOKEN?.trim() ?? "");
}
export async function wakeBangumi(store = db, force = false) {
  if (!process.env.BANGUMI_ACCESS_TOKEN?.trim()) return;
  await recoverExpired(store);
  const account = await getAccount(store);
  if (!account?.initialized || account.activeRunId) return;
  const pending = await store
    .select({ id: bangumiEntry.subjectId })
    .from(bangumiEntry)
    .where(and(eq(bangumiEntry.syncStatus, "pending"), eq(bangumiEntry.paused, false)))
    .limit(1);
  if (shouldSync(account, !!pending.length, force)) await synchronize(store, bangumiClient(), true);
}
export function startBangumiScheduler() {
  const tick = () =>
    void wakeBangumi().catch(() => {
      /* 运行失败由服务保存在后台状态；配置/断连等待下一轮 */
    });
  tick();
  setInterval(tick, 30000).unref();
}
export function shouldSync(
  account: { autoSync: boolean; lastAttemptAt: Date | null; lastError: string | null },
  pending: boolean,
  force = false,
  now = Date.now(),
) {
  const elapsed = account.lastAttemptAt ? now - account.lastAttemptAt.getTime() : Infinity;
  const pendingReady = pending && (force || elapsed >= (account.lastError ? 10 * 60000 : 30000));
  return pendingReady || (account.autoSync && elapsed >= 10 * 60000);
}
