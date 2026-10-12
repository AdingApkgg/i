import { friend } from "@i/db/schema";
import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, makeContext } from "../../../test/db";
import { friendsRouter } from "./friends";

const redis = vi.hoisted(() => ({ incr: vi.fn(), expire: vi.fn() }));
vi.mock("@i/db", async () => ({
  ...(await (await import("../../../test/mock-db")).dbModule()),
  redis,
}));
vi.mock("@/lib/auth", () => ({ auth: {} }));
// 邮件与存活检测都是发往外部的副作用
vi.mock("@/lib/mailer", () => ({
  notifyOwnerFriendApply: vi.fn(async () => {}),
  notifyApplicantReviewResult: vi.fn(async () => {}),
}));
vi.mock("../friend-check", () => ({
  checkFriend: vi.fn(async () => {}),
  runFriendChecks: vi.fn(async () => {}),
}));

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(() => t.close());
beforeEach(async () => {
  await t.reset();
  vi.clearAllMocks();
  redis.incr.mockResolvedValue(1);
  redis.expire.mockResolvedValue(1);
});

const ctx = (opts: Parameters<typeof makeContext>[1] = {}) => ({
  context: makeContext(t.db, opts),
});
const admin = () => ctx({ role: "admin" });
const friends = () => t.db.select().from(friend);
const seed = (row: Partial<typeof friend.$inferInsert>) =>
  t.db
    .insert(friend)
    .values({ name: "x", url: "https://x", ...row })
    .returning()
    .then((r) => r[0]!);

const apply = { name: "小站", url: "https://Blog.Example.com/", email: "a@b.cc" };

describe("friends.submit", () => {
  it("新申请落库为 pending，不出现在公开列表", async () => {
    const { id } = await call(friendsRouter.submit, apply, ctx());
    const [row] = await friends();
    expect(row).toMatchObject({ id, status: "pending", email: "a@b.cc", name: "小站" });
    await expect(call(friendsRouter.list, undefined, ctx())).resolves.toEqual([]);
  });

  it("非 http(s) 链接 → BAD_REQUEST", async () => {
    await expect(
      call(friendsRouter.submit, { ...apply, url: "ftp://example.com" }, ctx()),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "链接必须是 http(s) 地址" });
  });

  it("匿名且没留邮箱 → BAD_REQUEST；登录用户沿用账号邮箱", async () => {
    const { email: _, ...noEmail } = apply;
    await expect(call(friendsRouter.submit, noEmail, ctx())).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await call(friendsRouter.submit, noEmail, ctx({ role: "user", email: "me@x.cc" }));
    expect((await friends())[0]!.email).toBe("me@x.cc");
  });

  it("URL 归一化去重：大小写 / 尾斜杠不同也算同一个站", async () => {
    await seed({ url: "https://blog.example.com", status: "pending" });
    await expect(call(friendsRouter.submit, apply, ctx())).rejects.toMatchObject({
      code: "CONFLICT",
      message: "这个链接已经在审核队列里啦",
    });
    // 撞重复不消耗限流额度
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it("此前被拒绝的链接可以重新申请，复用原行并清空检测状态", async () => {
    const old = await seed({
      url: "https://blog.example.com",
      status: "rejected",
      failCount: 5,
      checkedAt: new Date(),
    });
    await call(friendsRouter.submit, apply, ctx());
    const all = await friends();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ id: old.id, status: "pending", failCount: 0, checkedAt: null });
  });

  it("同 IP 每小时超过 3 次 → TOO_MANY_REQUESTS", async () => {
    redis.incr.mockResolvedValue(4);
    await expect(call(friendsRouter.submit, apply, ctx())).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    expect(await friends()).toHaveLength(0);
  });

  it("redis 挂了放行，不挡正常申请", async () => {
    redis.incr.mockRejectedValue(new Error("ECONNREFUSED"));
    await call(friendsRouter.submit, apply, ctx());
    expect(await friends()).toHaveLength(1);
  });

  it("管理员不受限流", async () => {
    redis.incr.mockResolvedValue(99);
    await call(friendsRouter.submit, apply, admin());
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it.each([
    [{ "cf-connecting-ip": "1.1.1.1", "x-real-ip": "2.2.2.2" }, "1.1.1.1"],
    [{ "x-real-ip": "2.2.2.2", "x-forwarded-for": "9.9.9.9, 3.3.3.3" }, "2.2.2.2"],
    // XFF 首跳是客户端自报的，只信最后一跳（本机 nginx 追加）
    [{ "x-forwarded-for": "9.9.9.9, 3.3.3.3" }, "3.3.3.3"],
    [{}, "unknown"],
  ])("限流按可信 IP 计数 %o → %s", async (headers, ip) => {
    await call(friendsRouter.submit, apply, ctx({ headers }));
    expect(redis.incr).toHaveBeenCalledWith(`friend:apply:${ip}`);
  });
});

describe("friends 后台", () => {
  it("review 通过：进公开列表、排到末尾、默认分组「朋友」", async () => {
    await seed({ name: "老朋友", status: "active", sortOrder: 7, group: "朋友" });
    const p = await seed({ name: "新朋友", status: "pending" });
    await call(friendsRouter.review, { id: p.id, action: "approve" }, admin());
    const list = await call(friendsRouter.list, undefined, ctx());
    expect(list.map((f) => [f.name, f.sortOrder, f.group])).toEqual([
      ["老朋友", 7, "朋友"],
      ["新朋友", 8, "朋友"],
    ]);
    // 公开列表不泄露邮箱 / 留言
    expect(list[0]).not.toHaveProperty("email");
  });

  it("update 只改名字时不会把 status / sortOrder 重置成默认值", async () => {
    const f = await seed({ status: "pending", sortOrder: 3 });
    await call(friendsRouter.update, { id: f.id, name: "新名字" }, admin());
    expect((await friends())[0]).toMatchObject({ name: "新名字", status: "pending", sortOrder: 3 });
  });

  it("delete 不存在的 id → NOT_FOUND", async () => {
    await expect(call(friendsRouter.delete, { id: "nope" }, admin())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
