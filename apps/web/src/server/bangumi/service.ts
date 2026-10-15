import type { Db } from "@i/db";
import { bangumiAccount, bangumiEntry, bangumiRun } from "@i/db";
import { and, eq } from "drizzle-orm";
import type { BangumiClient } from "@/lib/bangumi/api.server";
import { mergeCollection, sameState } from "@/lib/bangumi/merge";
import type { Choices, CollectionState, RemoteEntry } from "@/lib/bangumi/types";
import {
  assertEditable,
  assertOwner,
  bindAccount,
  claim,
  finish,
  getAccount,
  getEntries,
  getRun,
  identicalRemote,
  type PlanEntry,
  type PreviewData,
  previewData,
  type Run,
  stateSchema,
} from "./repository";
export type Resolutions = Record<string, Choices>;

async function snapshot(db: Db, api: BangumiClient, run: Run): Promise<PreviewData> {
  await db
    .update(bangumiRun)
    .set({ progress: "只读扫描收藏与逐集进度，尚未写入" })
    .where(eq(bangumiRun.id, run.id));
  const remote = await api.snapshot(async (done, total) => {
    await assertOwner(db, run);
    await db
      .update(bangumiRun)
      .set({ progress: `只读扫描 ${done}/${total} 部，尚未写入` })
      .where(eq(bangumiRun.id, run.id));
  });
  await assertOwner(db, run);
  const local = await getEntries(db),
    ours = new Map(local.map((e) => [e.subjectId, e])),
    theirs = new Map(remote.map((e) => [e.subjectId, e]));
  const entries: PlanEntry[] = [...new Set([...ours.keys(), ...theirs.keys()])]
    .sort((a, b) => a - b)
    .map((subjectId) => {
      const l = ours.get(subjectId),
        r = theirs.get(subjectId);
      return {
        subjectId,
        metadata: r?.metadata ?? l!.metadata,
        base: l?.baseline ?? null,
        local: l?.state ?? null,
        remote: r?.state ?? null,
        revision: l?.revision ?? null,
        paused: l?.paused ?? false,
        uncertain: l?.writeUncertain ?? false,
      };
    });
  return {
    accountId: (await api.me()).id,
    entries,
    revisions: Object.fromEntries(local.map((e) => [e.subjectId, e.revision])),
  };
}
async function launch(db: Db, run: Run, background: boolean, work: () => Promise<Run>) {
  const execute = async () => {
    try {
      return await work();
    } catch (error) {
      await finish(db, run, "error", safeError(error));
      throw error;
    }
  };
  if (background) {
    void execute().catch(() => {});
    return run;
  }
  return execute();
}
function safeError(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 300) : "同步失败，请稍后重试";
}
async function connect(db: Db, api: BangumiClient) {
  await bindAccount(db, await api.me());
}

export async function createPreview(db: Db, api: BangumiClient, background = false) {
  await connect(db, api);
  const run = await claim(db, "preview");
  return launch(db, run, background, async () =>
    finish(db, run, "ready", null, await snapshot(db, api, run)),
  );
}
function checkRevisions(plan: PreviewData, now: PreviewData) {
  const left = Object.entries(plan.revisions).sort(),
    right = Object.entries(now.revisions).sort();
  if (JSON.stringify(left) !== JSON.stringify(right)) throw new Error("本站数据已变化，请重新演练");
  const oldRemote = plan.entries.filter((e) => e.remote),
    newRemote = now.entries.filter((e) => e.remote);
  if (oldRemote.length !== newRemote.length) throw new Error("Bangumi 收藏已变化，请重新演练");
  const current = new Map(newRemote.map((e) => [e.subjectId, e.remote]));
  for (const entry of oldRemote)
    identicalRemote(entry.remote, current.get(entry.subjectId) ?? null);
}
function unresolved(plan: PreviewData, choices: Resolutions) {
  return plan.entries.flatMap((e) =>
    mergeCollection(e.base, e.local, e.remote, choices[e.subjectId], e.uncertain).conflicts.map(
      (field) => `${e.subjectId}.${field}`,
    ),
  );
}
export async function confirmPreview(
  db: Db,
  api: BangumiClient,
  id: string,
  choices: Resolutions,
  background = false,
) {
  await connect(db, api);
  const source = await getRun(db, id);
  if (source.kind !== "preview" || source.status !== "ready")
    throw new Error("此预览已应用或不可用，请重新演练");
  if (source.expiresAt.getTime() <= Date.now()) throw new Error("预览已过期，请重新演练");
  const plan = previewData(source.data);
  if (plan.accountId !== (await api.me()).id) throw new Error("预览账号不匹配，请重新演练");
  if (unresolved(plan, choices).length) throw new Error("请先选择所有冲突字段，再确认应用");
  const run = await claim(db, "apply", { previewId: id });
  return launch(db, run, background, async () => {
    const now = await snapshot(db, api, run);
    if (source.expiresAt.getTime() <= Date.now()) throw new Error("预览已过期，请重新演练");
    checkRevisions(plan, now);
    // 全局互斥已经取得；消耗预览，双击或旧 ID 不能再次执行。
    const used = await db
      .update(bangumiRun)
      .set({ status: "applied" })
      .where(and(eq(bangumiRun.id, id), eq(bangumiRun.status, "ready")))
      .returning();
    if (!used.length) throw new Error("此预览已经应用，请重新演练");
    const result = await applyPlan(db, api, run, plan, choices, false);
    if (result.status === "success")
      await db
        .update(bangumiAccount)
        .set({ initialized: true })
        .where(eq(bangumiAccount.id, "current"));
    return result;
  });
}
export async function synchronize(db: Db, api: BangumiClient, background = false) {
  if (!(await getAccount(db))?.initialized) throw new Error("首次同步请先演练预览并确认应用");
  const run = await claim(db, "sync");
  return launch(db, run, background, async () => {
    await connect(db, api);
    return applyPlan(db, api, run, await snapshot(db, api, run), {}, true);
  });
}
async function applyPlan(
  db: Db,
  api: BangumiClient,
  run: Run,
  plan: PreviewData,
  choices: Resolutions,
  automatic: boolean,
) {
  const failures: string[] = [];
  let completed = 0;
  for (const item of plan.entries) {
    if (automatic && item.paused) continue;
    await assertOwner(db, run);
    await db
      .update(bangumiRun)
      .set({
        progress: `正在处理 ${++completed}/${plan.entries.length}：${item.metadata.nameCn || item.metadata.name}`,
      })
      .where(eq(bangumiRun.id, run.id));
    const decision = mergeCollection(
      item.base,
      item.local,
      item.remote,
      choices[item.subjectId],
      item.uncertain,
    );
    if (decision.conflicts.length) {
      if (item.local)
        await db
          .update(bangumiEntry)
          .set({
            syncStatus: "conflict",
            conflicts: decision.conflicts,
            lastRemote: item.remote,
            syncError: "双方修改冲突，请重新演练并选择",
          })
          .where(
            and(
              eq(bangumiEntry.subjectId, item.subjectId),
              eq(bangumiEntry.revision, item.revision!),
            ),
          );
      failures.push(`${item.subjectId} 存在冲突`);
      continue;
    }
    if (
      decision.merged &&
      item.remote &&
      !decision.push &&
      !decision.pull &&
      item.local &&
      sameState(item.base, item.local) &&
      !item.paused &&
      !item.uncertain
    ) {
      // 重新演练后已成功的条目不从头复核，限时中断也能逐批前进。
      await db
        .update(bangumiEntry)
        .set({
          metadata: item.metadata,
          state: item.remote!,
          baseline: item.remote!,
          syncStatus: "synced",
          syncError: null,
          conflicts: [],
          lastRemote: item.remote,
        })
        .where(
          and(
            eq(bangumiEntry.subjectId, item.subjectId),
            eq(bangumiEntry.revision, item.revision!),
          ),
        );
      continue;
    }
    let expectedRevision = item.revision;
    try {
      // 外部写之前提交完整目标与不确定标记；远端副作用/进程重启都不能吞掉逐集选择。
      if (decision.push && decision.merged) {
        await db.transaction(async (tx) => {
          const [local] = await tx
            .select()
            .from(bangumiEntry)
            .where(eq(bangumiEntry.subjectId, item.subjectId))
            .for("update");
          if (!local || local.revision !== item.revision)
            throw new Error("本站数据已变化，请重新演练");
          await assertOwner(tx, run);
          expectedRevision = local.revision + 1;
          await tx
            .update(bangumiEntry)
            .set({
              state: decision.merged!,
              writeUncertain: true,
              syncStatus: "writing",
              revision: expectedRevision,
            })
            .where(eq(bangumiEntry.subjectId, item.subjectId));
        });
      }
      await db.transaction(async (tx) => {
        const [local] = await tx
          .select()
          .from(bangumiEntry)
          .where(eq(bangumiEntry.subjectId, item.subjectId))
          .for("update");
        if ((local?.revision ?? null) !== expectedRevision)
          throw new Error("本站数据已变化，请重新演练");
        const remote = await api.entry(item.subjectId);
        identicalRemote(item.remote, remote?.state ?? null);
        await assertOwner(tx, run);
        const target = decision.merged;
        if (!target) {
          if (local)
            await tx
              .update(bangumiEntry)
              .set({
                paused: true,
                writeUncertain: false,
                syncStatus: "paused",
                syncError: null,
                conflicts: [],
                lastRemote: null,
                revision: local.revision + 1,
              })
              .where(eq(bangumiEntry.subjectId, item.subjectId));
          return;
        }
        let confirmed: RemoteEntry | null = remote;
        if (decision.push) {
          await api.write(item.subjectId, remote?.state ?? null, target);
          confirmed = await api.entry(item.subjectId);
        }
        if (!confirmed || !sameState(confirmed.state, target))
          throw new Error("写入后读回核对不一致，保留本站修改等待重试");
        const metadata = confirmed.metadata;
        if (
          local &&
          sameState(local.state, target) &&
          sameState(local.baseline, target) &&
          !local.paused &&
          local.syncStatus === "synced" &&
          JSON.stringify(local.metadata) === JSON.stringify(metadata)
        )
          return;
        const data = {
          metadata,
          state: confirmed.state,
          baseline: confirmed.state,
          lastRemote: confirmed.state,
          syncStatus: "synced",
          syncError: null,
          conflicts: [],
          paused: false,
          writeUncertain: false,
          revision: (local?.revision ?? 0) + 1,
        };
        if (local)
          await tx.update(bangumiEntry).set(data).where(eq(bangumiEntry.subjectId, item.subjectId));
        else await tx.insert(bangumiEntry).values({ subjectId: item.subjectId, ...data });
      });
    } catch (error) {
      const message = safeError(error);
      failures.push(`${item.subjectId}：${message}`);
      if (item.local)
        await db
          .update(bangumiEntry)
          .set({ syncStatus: "error", syncError: message })
          .where(
            and(
              eq(bangumiEntry.subjectId, item.subjectId),
              eq(bangumiEntry.revision, expectedRevision!),
            ),
          );
    }
  }
  return finish(
    db,
    run,
    failures.length ? "error" : "success",
    failures.length ? failures.slice(0, 5).join("；") : null,
    { completed, failures },
  );
}
export async function saveEntry(db: Db, id: number, revision: number, input: CollectionState) {
  const state = stateSchema.parse(input);
  return db.transaction(async (tx) => {
    await assertEditable(tx);
    const [row] = await tx
      .select()
      .from(bangumiEntry)
      .where(eq(bangumiEntry.subjectId, id))
      .for("update");
    if (!row) throw new Error("番剧不存在");
    if (row.syncStatus === "writing" && (await getAccount(tx))?.activeRunId)
      throw new Error("正在写入该条目，请稍后编辑");
    if (row.revision !== revision) throw new Error("该条目已变化，请刷新后重新编辑");
    const known = new Set(row.metadata.episodes.map((e) => String(e.id)));
    if (Object.keys(state.episodes).some((key) => !known.has(key)))
      throw new Error("章节信息已变化，请刷新后重试");
    // 省略章节也不能悄悄清除已看标记。
    if ([...known].some((key) => !(key in state.episodes))) throw new Error("请提交完整的逐集状态");
    const [result] = await tx
      .update(bangumiEntry)
      .set({
        state,
        revision: revision + 1,
        syncStatus: row.paused ? "paused" : "pending",
        syncError: null,
        conflicts: [],
      })
      .where(eq(bangumiEntry.subjectId, id))
      .returning();
    return result!;
  });
}
export async function addEntry(db: Db, api: BangumiClient, id: number) {
  await connect(db, api);
  const metadata = await api.subject(id);
  return db.transaction(async (tx) => {
    await assertEditable(tx);
    const [row] = await tx
      .insert(bangumiEntry)
      .values({
        subjectId: id,
        metadata,
        state: {
          type: 1,
          rate: 0,
          comment: "",
          private: true,
          episodes: Object.fromEntries(metadata.episodes.map((e) => [e.id, 0])),
        },
      })
      .onConflictDoNothing()
      .returning();
    if (!row) throw new Error("该番剧已存在，请直接编辑");
    return row;
  });
}
