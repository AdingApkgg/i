import { call, ORPCError } from "@orpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Context } from "./orpc";
import { musicRouter } from "./routers/content";

// orpc.ts 会连带加载真实的 Prisma / better-auth，这里只需要类型和中间件
vi.mock("@i/db", () => ({ db: {} }));
vi.mock("@/lib/auth", () => ({ auth: {} }));

const track = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

function ctx(role?: string): Context {
  const user = role ? { id: "u1", role } : null;
  return {
    db: { track } as unknown as Context["db"],
    session: user ? ({ user } as unknown as Context["session"]) : null,
    user: user as unknown as Context["user"],
    headers: new Headers(),
  };
}
const admin = { context: ctx("admin") };

beforeEach(() => {
  for (const fn of Object.values(track)) fn.mockReset();
});

describe("crudRouter 权限", () => {
  it("list 公开可读", async () => {
    track.findMany.mockResolvedValue([{ id: "a" }]);
    await expect(call(musicRouter.list, undefined, { context: ctx() })).resolves.toEqual([
      { id: "a" },
    ]);
  });

  it("未登录写入 → UNAUTHORIZED", async () => {
    await expect(
      call(musicRouter.create, { title: "x" }, { context: ctx() }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(track.create).not.toHaveBeenCalled();
  });

  it("普通用户写入 → FORBIDDEN", async () => {
    await expect(
      call(musicRouter.delete, { id: "a" }, { context: ctx("user") }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("owner 与 admin 同权", async () => {
    track.delete.mockResolvedValue({ id: "a" });
    await call(musicRouter.delete, { id: "a" }, { context: ctx("owner") });
    expect(track.delete).toHaveBeenCalledWith({ where: { id: "a" } });
  });
});

describe("crudRouter create / update", () => {
  it("create：注入默认值，清空的排序（null）归零", async () => {
    track.create.mockImplementation(async ({ data }) => ({ id: "n", ...data }));
    await call(musicRouter.create, { title: "歌", sortOrder: null }, admin);
    expect(track.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ title: "歌", status: "在听", sortOrder: 0 }),
    });
  });

  it("update：缺省字段保持 undefined，不会被默认值悄悄重置", async () => {
    track.update.mockResolvedValue({ id: "a" });
    await call(musicRouter.update, { id: "a", title: "新名字" }, admin);
    const { data } = track.update.mock.calls[0]![0];
    expect(data).toEqual({ title: "新名字" });
    expect(data).not.toHaveProperty("status");
  });

  it("update：枚举仍然校验", async () => {
    await expect(
      call(musicRouter.update, { id: "a", status: "乱填" as never }, admin),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(track.update).not.toHaveBeenCalled();
  });

  it("create：缺必填字段 → BAD_REQUEST 且带 issues", async () => {
    const err = await call(musicRouter.create, {} as never, admin).catch((e) => e);
    expect(err).toBeInstanceOf(ORPCError);
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.data.issues[0].path).toEqual(["title"]);
  });
});

describe("withDbErrors：Prisma 约束错误 → 语义化错误", () => {
  const prismaErr = (code: string) => Object.assign(new Error(code), { code });

  it.each([
    ["P2002", "CONFLICT", "已存在同名记录"],
    ["P2003", "BAD_REQUEST", "关联的记录不存在（可能已被删除）"],
    ["P2025", "NOT_FOUND", "记录不存在"],
  ])("%s → %s", async (prismaCode, code, message) => {
    track.create.mockRejectedValue(prismaErr(prismaCode));
    await expect(call(musicRouter.create, { title: "x" }, admin)).rejects.toMatchObject({
      code,
      message,
    });
  });

  it("其它错误原样抛出", async () => {
    track.create.mockRejectedValue(new Error("boom"));
    await expect(call(musicRouter.create, { title: "x" }, admin)).rejects.toThrow("boom");
  });
});

describe("crudRouter page：游标分页", () => {
  it("多取一条探测下一页，nextCursor 为本页最后一条", async () => {
    track.findMany.mockResolvedValue([{ id: "1" }, { id: "2" }, { id: "3" }]);
    const res = await call(musicRouter.page, { limit: 2 }, { context: ctx() });
    expect(res).toEqual({ items: [{ id: "1" }, { id: "2" }], nextCursor: "2" });
    expect(track.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }));
  });

  it("带游标时跳过游标行；没有更多时 nextCursor 为 null", async () => {
    track.findMany.mockResolvedValue([{ id: "3" }]);
    const res = await call(musicRouter.page, { limit: 2, cursor: "2" }, { context: ctx() });
    expect(res.nextCursor).toBeNull();
    expect(track.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "2" }, skip: 1 }),
    );
  });
});
