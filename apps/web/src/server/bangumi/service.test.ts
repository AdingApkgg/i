import { bangumiAccount, bangumiEntry, bangumiRun } from "@i/db/schema";
import { call } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { BangumiClient } from "@/lib/bangumi/api.server";
import type { CollectionState, RemoteEntry } from "@/lib/bangumi/types";
import { createTestDb, makeContext } from "../../../test/db";
import { bangumiRouter } from "../routers/bangumi";
import { addEntry, confirmPreview, createPreview, saveEntry, synchronize } from "./service";

vi.mock("@i/db", async () => (await import("../../../test/mock-db")).dbModule());
vi.mock("@/lib/auth", () => ({ auth: {} }));
let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(() => t.close());
beforeEach(() => t.reset());
const initial: CollectionState = {
  type: 3,
  rate: 0,
  comment: "",
  private: false,
  episodes: { "101": 2, "105": 0 },
};
const metadata = {
  id: 8,
  name: "Test",
  nameCn: "测试番剧",
  image: "",
  date: "2026-01-01",
  eps: 2,
  score: 8,
  episodes: [
    { id: 101, sort: 1, name: "第一集", type: 0 },
    { id: 105, sort: 2.5, name: "特别篇", type: 1 },
  ],
};
function remote() {
  const rows = new Map<number, RemoteEntry>([
    [8, { subjectId: 8, metadata, state: structuredClone(initial) }],
  ]);
  let writes = 0;
  let fail = false;
  const api = {
    me: async () => ({ id: 7, username: "owner" }),
    snapshot: async () => structuredClone([...rows.values()]),
    entry: async (id: number) => structuredClone(rows.get(id) ?? null),
    subject: async (id: number) => ({ ...metadata, id }),
    write: async (id: number, _old: CollectionState | null, state: CollectionState) => {
      if (fail) throw new Error("HTTP 503");
      writes++;
      rows.set(id, { subjectId: id, metadata: { ...metadata, id }, state: structuredClone(state) });
    },
  } as unknown as BangumiClient;
  return {
    api,
    rows,
    writes: () => writes,
    setFail: (v: boolean) => {
      fail = v;
    },
  };
}
async function entry(id = 8) {
  return (await t.db.select().from(bangumiEntry).where(eq(bangumiEntry.subjectId, id)))[0]!;
}
async function activated(r: ReturnType<typeof remote>) {
  const p = await createPreview(t.db, r.api);
  await confirmPreview(t.db, r.api, p.id, {});
}

describe("Bangumi preview-first service", () => {
  it("首次演练零写入、私有内容只在确认后入库且公开查询排除", async () => {
    const r = remote();
    r.rows.get(8)!.state.private = true;
    const p = await createPreview(t.db, r.api);
    expect(p.status).toBe("ready");
    expect(await t.db.select().from(bangumiEntry)).toEqual([]);
    expect(r.writes()).toBe(0);
    await expect(synchronize(t.db, r.api)).rejects.toThrow(/演练/);
    await confirmPreview(t.db, r.api, p.id, {});
    expect((await entry()).baseline?.private).toBe(true);
    expect(r.writes()).toBe(0);
    expect(await call(bangumiRouter.publicList, undefined, { context: makeContext(t.db) })).toEqual(
      [],
    );
  });
  it("确认前远端变化使旧预览失效且零写入，重复确认也拒绝", async () => {
    const r = remote(),
      p = await createPreview(t.db, r.api);
    r.rows.get(8)!.state.rate = 9;
    await expect(confirmPreview(t.db, r.api, p.id, {})).rejects.toThrow(/变化|重新演练/);
    expect(r.writes()).toBe(0);
    expect(await t.db.select().from(bangumiEntry)).toEqual([]);
    const q = await createPreview(t.db, r.api);
    await confirmPreview(t.db, r.api, q.id, {});
    await expect(confirmPreview(t.db, r.api, q.id, {})).rejects.toThrow(/预览|应用/);
  });
  it("本地 revision 或预览过期均拒绝应用", async () => {
    const r = remote();
    await activated(r);
    const p = await createPreview(t.db, r.api);
    await saveEntry(t.db, 8, (await entry()).revision, { ...initial, comment: "本地新评" });
    await expect(confirmPreview(t.db, r.api, p.id, {})).rejects.toThrow(/变化|重新演练/);
    const q = await createPreview(t.db, r.api);
    await t.db
      .update(bangumiRun)
      .set({ expiresAt: new Date(0) })
      .where(eq(bangumiRun.id, q.id));
    await expect(confirmPreview(t.db, r.api, q.id, {})).rejects.toThrow(/过期/);
    expect(r.writes()).toBe(0);
  });
  it("双向合并不同字段及每集状态，清零不丢失，旧表单不能覆盖", async () => {
    const r = remote();
    await activated(r);
    const before = await entry();
    await saveEntry(t.db, 8, before.revision, {
      ...initial,
      type: 2,
      episodes: { "101": 2, "105": 3 },
    });
    await expect(saveEntry(t.db, 8, before.revision, initial)).rejects.toThrow(/变化|刷新/);
    r.rows.get(8)!.state.rate = 9;
    r.rows.get(8)!.state.comment = "远端短评";
    await synchronize(t.db, r.api);
    expect((await entry()).state).toEqual({
      ...initial,
      type: 2,
      rate: 9,
      comment: "远端短评",
      episodes: { "101": 2, "105": 3 },
    });
    expect(r.rows.get(8)!.state).toEqual((await entry()).state);
    const current = await entry();
    await saveEntry(t.db, 8, current.revision, { ...current.state, rate: 0, comment: "" });
    await synchronize(t.db, r.api);
    expect(r.rows.get(8)!.state.rate).toBe(0);
    expect(r.rows.get(8)!.state.comment).toBe("");
  });
  it("同字段冲突不推送，明确选择后的新预览才解决", async () => {
    const r = remote();
    await activated(r);
    await saveEntry(t.db, 8, (await entry()).revision, { ...initial, rate: 8 });
    r.rows.get(8)!.state.rate = 9;
    await synchronize(t.db, r.api);
    expect((await entry()).syncStatus).toBe("conflict");
    expect(r.writes()).toBe(0);
    const p = await createPreview(t.db, r.api);
    await expect(confirmPreview(t.db, r.api, p.id, {})).rejects.toThrow(/冲突/);
    // 未解决的输入不会消耗预览。
    await confirmPreview(t.db, r.api, p.id, { "8": { rate: "local" } });
    expect(r.rows.get(8)!.state.rate).toBe(8);
  });
  it("远端取消不重建，选择保留本站则暂停条目同步", async () => {
    const r = remote();
    await activated(r);
    r.rows.delete(8);
    await synchronize(t.db, r.api);
    expect(r.writes()).toBe(0);
    const p = await createPreview(t.db, r.api);
    await confirmPreview(t.db, r.api, p.id, { "8": { collection: "remote" } });
    expect((await entry()).paused).toBe(true);
    await synchronize(t.db, r.api);
    expect(r.rows.size).toBe(0);
  });
  it("上游部分写失败保留待同步数据，重试后恢复 baseline", async () => {
    const r = remote();
    await activated(r);
    await saveEntry(t.db, 8, (await entry()).revision, { ...initial, comment: "不能丢" });
    r.setFail(true);
    const run = await synchronize(t.db, r.api);
    expect(run.status).toBe("error");
    expect((await entry()).state.comment).toBe("不能丢");
    expect((await entry()).baseline?.comment).toBe("");
    r.setFail(false);
    const retry = await createPreview(t.db, r.api);
    await confirmPreview(t.db, r.api, retry.id, { "8": { write: "local" } });
    expect((await entry()).baseline?.comment).toBe("不能丢");
  });
  it("换账号、已在运行、未激活自动同步和非管理员均不能越过保护", async () => {
    const r = remote();
    await activated(r);
    const other = { ...r.api, me: async () => ({ id: 9, username: "other" }) } as BangumiClient;
    await expect(createPreview(t.db, other)).rejects.toThrow(/账号/);
    await t.db.update(bangumiAccount).set({ activeRunId: "busy", activeSince: new Date() });
    await expect(createPreview(t.db, r.api)).rejects.toThrow(/运行/);
    await expect(
      call(bangumiRouter.preview, undefined, { context: makeContext(t.db) }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      call(bangumiRouter.preview, undefined, { context: makeContext(t.db, { role: "user" }) }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("首次本站独有条目必须确认后才新增到 Bangumi", async () => {
    const r = remote();
    r.rows.clear();
    await addEntry(t.db, r.api, 8);
    const p = await createPreview(t.db, r.api);
    expect(r.writes()).toBe(0);
    await confirmPreview(t.db, r.api, p.id, {});
    expect(r.rows.get(8)?.state).toMatchObject({ type: 1, private: true });
  });
});

describe("Bangumi 运行恢复与确认互斥", () => {
  it("进程中断超过执行上限后，后台状态释放旧任务以便重新演练", async () => {
    const r = remote();
    await activated(r);
    const [run] = await t.db
      .insert(bangumiRun)
      .values({ kind: "sync", createdAt: new Date(Date.now() - 20 * 60000), expiresAt: new Date() })
      .returning();
    await t.db
      .update(bangumiAccount)
      .set({ activeRunId: run!.id, activeSince: new Date(Date.now() - 20 * 60000) });
    const status = await call(bangumiRouter.status, undefined, {
      context: makeContext(t.db, { role: "admin" }),
    });
    expect(status.account?.activeRunId).toBeNull();
    expect(
      (await t.db.select().from(bangumiRun).where(eq(bangumiRun.id, run!.id)))[0]?.status,
    ).toBe("error");
  });
  it("确认应用期间拒绝并发新增和编辑，不让未预览的新记录绕过首次确认", async () => {
    const r = remote();
    await activated(r);
    const [run] = await t.db
      .insert(bangumiRun)
      .values({ kind: "apply", expiresAt: new Date(Date.now() + 60000) })
      .returning();
    await t.db
      .update(bangumiAccount)
      .set({ initialized: false, activeRunId: run!.id, activeSince: new Date() });
    await expect(
      saveEntry(t.db, 8, (await entry()).revision, { ...initial, rate: 8 }),
    ).rejects.toThrow(/应用|稍后/);
    await expect(addEntry(t.db, r.api, 9)).rejects.toThrow(/应用|稍后/);
  });
});

describe("Bangumi 不确定写入恢复", () => {
  it("整部状态已写入、恢复章节前失败时，后续同步不能吞掉明确的逐集选择", async () => {
    const r = remote();
    await activated(r);
    await saveEntry(t.db, 8, (await entry()).revision, { ...initial, type: 2 });
    const original = r.api.write.bind(r.api);
    r.api.write = async (id, _before, target) => {
      r.rows.set(id, {
        subjectId: id,
        metadata,
        state: { ...target, episodes: { "101": 2, "105": 2 } },
      });
      throw new Error("恢复逐集状态时 HTTP 503");
    };
    await synchronize(t.db, r.api);
    expect((await entry()).state.episodes["105"]).toBe(0);
    r.api.write = original;
    await synchronize(t.db, r.api);
    expect((await entry()).state.episodes["105"]).toBe(0);
    expect((await entry()).syncStatus).toBe("conflict");
    const p = await createPreview(t.db, r.api);
    await expect(confirmPreview(t.db, r.api, p.id, {})).rejects.toThrow(/冲突/);
    await confirmPreview(t.db, r.api, p.id, { "8": { write: "local" } });
    expect(r.rows.get(8)!.state.episodes["105"]).toBe(0);
    expect((await entry()).baseline?.episodes["105"]).toBe(0);
  });
});

describe("Bangumi 鉴权失败的同步冷却", () => {
  it("token验证失败也记录一次尝试与错误并释放任务，不每30秒重连", async () => {
    const r = remote();
    await activated(r);
    await t.db.update(bangumiAccount).set({ lastAttemptAt: new Date(0) });
    const invalid = {
      ...r.api,
      me: async () => {
        throw new Error("HTTP 401，token 已失效");
      },
    } as unknown as BangumiClient;
    await expect(synchronize(t.db, invalid)).rejects.toThrow(/401/);
    const account = (await t.db.select().from(bangumiAccount))[0]!;
    expect(account.lastError).toContain("401");
    expect(account.lastAttemptAt!.getTime()).toBeGreaterThan(0);
    expect(account.activeRunId).toBeNull();
  });
});

describe("Bangumi 不确定写入隐私", () => {
  it("扫描时公开但写前恢复私有时，未确认的合并目标不能公开", async () => {
    const r = remote();
    r.rows.get(8)!.state.private = true;
    await activated(r);
    const old = await entry();
    await saveEntry(t.db, 8, old.revision, { ...old.state, comment: "私有短评" });
    r.rows.get(8)!.state.private = false;
    r.api.entry = async () => ({
      ...structuredClone(r.rows.get(8)!),
      state: { ...initial, private: true },
    });
    await synchronize(t.db, r.api);
    expect((await entry()).writeUncertain).toBe(true);
    expect(await call(bangumiRouter.publicList, undefined, { context: makeContext(t.db) })).toEqual(
      [],
    );
  });
});
