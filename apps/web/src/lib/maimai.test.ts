import { maimaiConfig, maimaiProfile, maimaiRecord } from "@i/db/schema";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "../../test/db";
import { syncMaimai } from "./maimai";

// syncMaimai 直接用全局 db：模块 mock 里用 getter 指向测试库
const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@i/db", async () => {
  const base = await (await import("../../test/mock-db")).dbModule();
  return {
    ...base,
    get db() {
      return holder.db;
    },
  };
});

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
  holder.db = t.db;
});
afterAll(() => t.close());
beforeEach(async () => {
  await t.reset();
  vi.unstubAllGlobals();
});

/** 水鱼返回：b50（sd 2 条 + dx 1 条）+ Import-Token 的全部成绩 n 条 */
function stubDivingFish(n: number, nickname = "舞萌人") {
  const chart = (song_id: number, level_index: number, type = "SD") => ({
    song_id,
    title: `曲${song_id}`,
    type,
    level_index,
    level: "13+",
    ds: 13.7,
    achievements: 100.5,
    dxScore: 2000,
    ra: 300,
    fc: "fc",
    fs: "",
    rate: "sssp",
  });
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith("/query/player")) {
      return Response.json({
        nickname,
        rating: 15000,
        charts: { sd: [chart(1, 3), chart(2, 3)], dx: [chart(10001, 2, "DX")] },
      });
    }
    // 全部成绩：song × 难度 组合唯一
    const records = Array.from({ length: n }, (_, i) => chart(100 + Math.floor(i / 5), i % 5));
    return Response.json({ records: [...records, chart(1, 3)] }); // 与 b50 重叠一条
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("syncMaimai", () => {
  it("没配置时报错", async () => {
    await expect(syncMaimai()).rejects.toThrow("请先在后台配置查分器");
  });

  it("全量替换成绩（分批插入上千行），b50 覆盖池位，档案 upsert", async () => {
    await t.db
      .insert(maimaiConfig)
      .values({ source: "diving-fish", divingFishUsername: "me", divingFishImportToken: "tok" });

    stubDivingFish(2500);
    const r1 = await syncMaimai();
    // 全部成绩 2500 + 1（与 b50 重叠的那条）∪ b50 3 条 → 去重后 2503
    expect(r1).toEqual({ source: "diving-fish", nickname: "舞萌人", rating: 15000, count: 2503 });
    expect(await t.db.$count(maimaiRecord)).toBe(2503);
    const pools = await t.db.select({ pool: maimaiRecord.pool }).from(maimaiRecord);
    expect(pools.filter((p) => p.pool === "b35")).toHaveLength(2);
    expect(pools.filter((p) => p.pool === "b15")).toHaveLength(1);

    // 再同步一次：旧成绩整体替换而不是累加，档案就地更新
    stubDivingFish(10, "改名了");
    await syncMaimai();
    expect(await t.db.$count(maimaiRecord)).toBe(13);
    const profiles = await t.db.select().from(maimaiProfile);
    expect(profiles).toEqual([expect.objectContaining({ id: "current", nickname: "改名了" })]);
  });

  it("中途失败整体回滚：旧成绩保留", async () => {
    await t.db.insert(maimaiConfig).values({ divingFishUsername: "me" });
    stubDivingFish(3);
    await syncMaimai();
    const before = await t.db.$count(maimaiRecord);

    // 造一条 songId 为 NaN 的脏数据（JSON 里 NaN 会变 null，所以用非数字字符串）：
    // 删旧成绩之后、插新成绩时 Postgres 报错，整个事务应回滚
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          nickname: "x",
          rating: 1,
          charts: { sd: [{ song_id: "坏数据" }], dx: [] },
        }),
      ),
    );
    await expect(syncMaimai()).rejects.toThrow();
    expect(await t.db.$count(maimaiRecord)).toBe(before);
  });
});
