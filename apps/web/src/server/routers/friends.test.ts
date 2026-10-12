import { call } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "../orpc";
import { friendsRouter } from "./friends";

const redis = vi.hoisted(() => ({ incr: vi.fn(), expire: vi.fn() }));
vi.mock("@i/db", () => ({
  db: {},
  redis,
  KEYS: { friendApply: (ip: string) => `friend:apply:${ip}` },
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

const friend = {
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
};

function ctx(opts: { role?: string; headers?: Record<string, string> } = {}): Context {
  const user = opts.role ? { id: "u1", role: opts.role, email: "me@x.cc", image: null } : null;
  return {
    db: { friend } as unknown as Context["db"],
    session: user ? ({ user } as unknown as Context["session"]) : null,
    user: user as unknown as Context["user"],
    headers: new Headers(opts.headers),
  };
}

const apply = { name: "小站", url: "https://Blog.Example.com/", email: "a@b.cc" };

beforeEach(() => {
  vi.clearAllMocks();
  friend.findMany.mockResolvedValue([]);
  friend.create.mockImplementation(async ({ data }) => ({ id: "new", ...data }));
  friend.update.mockImplementation(async ({ where, data }) => ({ id: where.id, ...data }));
  redis.incr.mockResolvedValue(1);
  redis.expire.mockResolvedValue(1);
});

describe("friends.submit", () => {
  it("新申请落库为 pending", async () => {
    await expect(call(friendsRouter.submit, apply, { context: ctx() })).resolves.toEqual({
      id: "new",
    });
    expect(friend.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "pending", email: "a@b.cc", name: "小站" }),
    });
  });

  it("非 http(s) 链接 → BAD_REQUEST", async () => {
    await expect(
      call(friendsRouter.submit, { ...apply, url: "ftp://example.com" }, { context: ctx() }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "链接必须是 http(s) 地址" });
  });

  it("匿名且没留邮箱 → BAD_REQUEST；登录用户沿用账号邮箱", async () => {
    const { email: _, ...noEmail } = apply;
    await expect(call(friendsRouter.submit, noEmail, { context: ctx() })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await call(friendsRouter.submit, noEmail, { context: ctx({ role: "user" }) });
    expect(friend.create.mock.calls[0]![0].data.email).toBe("me@x.cc");
  });

  it("URL 归一化去重：大小写 / 尾斜杠不同也算同一个站", async () => {
    friend.findMany.mockResolvedValue([
      { id: "f1", url: "https://blog.example.com", status: "pending" },
    ]);
    await expect(call(friendsRouter.submit, apply, { context: ctx() })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "这个链接已经在审核队列里啦",
    });
    // 撞重复不消耗限流额度
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it("此前被拒绝的链接可以重新申请，复用原行并清空检测状态", async () => {
    friend.findMany.mockResolvedValue([
      { id: "f1", url: "https://blog.example.com", status: "rejected" },
    ]);
    await call(friendsRouter.submit, apply, { context: ctx() });
    expect(friend.create).not.toHaveBeenCalled();
    expect(friend.update).toHaveBeenCalledWith({
      where: { id: "f1" },
      data: expect.objectContaining({ status: "pending", checkedAt: null, failCount: 0 }),
    });
  });

  it("同 IP 每小时超过 3 次 → TOO_MANY_REQUESTS", async () => {
    redis.incr.mockResolvedValue(4);
    await expect(call(friendsRouter.submit, apply, { context: ctx() })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
    expect(friend.create).not.toHaveBeenCalled();
  });

  it("redis 挂了放行，不挡正常申请", async () => {
    redis.incr.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(call(friendsRouter.submit, apply, { context: ctx() })).resolves.toEqual({
      id: "new",
    });
  });

  it("管理员不受限流", async () => {
    redis.incr.mockResolvedValue(99);
    await call(friendsRouter.submit, apply, { context: ctx({ role: "admin" }) });
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it.each([
    [{ "cf-connecting-ip": "1.1.1.1", "x-real-ip": "2.2.2.2" }, "1.1.1.1"],
    [{ "x-real-ip": "2.2.2.2", "x-forwarded-for": "9.9.9.9, 3.3.3.3" }, "2.2.2.2"],
    // XFF 首跳是客户端自报的，只信最后一跳（本机 nginx 追加）
    [{ "x-forwarded-for": "9.9.9.9, 3.3.3.3" }, "3.3.3.3"],
    [{}, "unknown"],
  ])("限流按可信 IP 计数 %o → %s", async (headers, ip) => {
    await call(friendsRouter.submit, apply, { context: ctx({ headers }) });
    expect(redis.incr).toHaveBeenCalledWith(`friend:apply:${ip}`);
  });
});

describe("friends.update", () => {
  it("只改名字时不会把 status / sortOrder 重置成默认值", async () => {
    await call(
      friendsRouter.update,
      { id: "f1", name: "新名字" },
      { context: ctx({ role: "admin" }) },
    );
    const { data } = friend.update.mock.calls[0]![0];
    expect(data).not.toHaveProperty("status");
    expect(data).not.toHaveProperty("sortOrder");
    expect(data.name).toBe("新名字");
  });
});
