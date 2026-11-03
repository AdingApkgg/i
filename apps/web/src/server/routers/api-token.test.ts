import { apiToken as tokenTable, user } from "@i/db/schema";
import { call } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, makeContext } from "../../../test/db";
import { apiTokenRouter as apiToken } from "./api-token";

/** api-token.ts 用的模块级 db 换成 PGlite；getter 保证 beforeEach 后仍指向同一实例 */
const holder = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@i/db", async () => {
  const mod = await import("../../../test/mock-db");
  return {
    ...(await mod.dbModule()),
    get db() {
      return holder.db;
    },
  };
});
vi.mock("@/lib/auth", () => ({ auth: {} }));

const token = await import("../api-token");

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
  holder.db = t.db;
});
afterAll(() => t.close());
beforeEach(async () => {
  await t.reset();
  token.clearTokenCache();
  await t.db.insert(user).values({ id: "u1", email: "me@x.cc", name: "me", role: "admin" });
});

const asAdmin = (scope?: "read" | "write") => makeContext(t.db, { role: "admin", token: scope });
const asRead = () => asAdmin("read");

describe("签发与列出", () => {
  it("只返回一次明文，库里只存哈希与前缀", async () => {
    const out = await call(apiToken.create, { name: "pi" }, { context: asAdmin() });
    expect(out.secret.startsWith("i_")).toBe(true);
    expect(out.secret.length).toBeGreaterThan(20);

    const [row] = await t.db.select().from(tokenTable);
    expect(row!.tokenHash).toBe(token.hashToken(out.secret));
    expect(row!.tokenHash).not.toBe(out.secret);
    expect(row!.prefix).toBe(out.secret.slice(0, 8));
    expect(row!.scope).toBe("read");

    const list = await call(apiToken.list, undefined, { context: asAdmin() });
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).not.toHaveProperty("secret");
    expect(list.activeCount).toBe(1);
  });

  it("超过 20 个有效 token 报 400", async () => {
    for (let i = 0; i < 20; i++)
      await call(apiToken.create, { name: `t${i}` }, { context: asAdmin() });
    await expect(call(apiToken.create, { name: "over" }, { context: asAdmin() })).rejects.toThrow(
      /最多同时保留 20 个有效 token/,
    );
  });

  it("撤销后不再占名额", async () => {
    for (let i = 0; i < 20; i++)
      await call(apiToken.create, { name: `t${i}` }, { context: asAdmin() });
    const list = await call(apiToken.list, undefined, { context: asAdmin() });
    await call(apiToken.revoke, { id: list.items[0]!.id }, { context: asAdmin() });
    await expect(
      call(apiToken.create, { name: "ok" }, { context: asAdmin() }),
    ).resolves.toBeTruthy();
  });
});

describe("撤销与删除", () => {
  it("撤销保留行、删除才消失", async () => {
    const { token: row } = await call(apiToken.create, { name: "x" }, { context: asAdmin() });
    const id = row.id;
    await call(apiToken.revoke, { id }, { context: asAdmin() });
    let list = await call(apiToken.list, undefined, { context: asAdmin() });
    expect(list.items[0]!.revokedAt).toBeTruthy();
    expect(list.activeCount).toBe(0);

    await call(apiToken.delete, { id }, { context: asAdmin() });
    list = await call(apiToken.list, undefined, { context: asAdmin() });
    expect(list.items).toHaveLength(0);
  });

  it("重复撤销 404", async () => {
    const { token: row } = await call(apiToken.create, { name: "x" }, { context: asAdmin() });
    const id = row.id;
    await call(apiToken.revoke, { id }, { context: asAdmin() });
    await expect(call(apiToken.revoke, { id }, { context: asAdmin() })).rejects.toThrow();
  });
});

describe("verifyToken", () => {
  const mint = async (scope: "read" | "write" = "write", expiresAt: Date | null = null) => {
    const { secret, values } = token.mintToken("u1", "k", scope, expiresAt);
    await t.db.insert(tokenTable).values(values);
    return secret;
  };

  it("有效 token 解出用户与范围", async () => {
    const secret = await mint();
    const hit = await token.verifyToken(secret);
    expect(hit?.scope).toBe("write");
    expect(hit?.user.email).toBe("me@x.cc");
  });

  it("过期、吊销、伪造都返回 null", async () => {
    const expired = await mint("write", new Date(Date.now() - 1000));
    expect(await token.verifyToken(expired)).toBeNull();

    const secret = await mint();
    await t.db
      .update(tokenTable)
      .set({ revokedAt: new Date() })
      .where(eq(tokenTable.tokenHash, token.hashToken(secret)));
    token.clearTokenCache();
    expect(await token.verifyToken(secret)).toBeNull();
    expect(await token.verifyToken("i_nope")).toBeNull();
  });

  it("缓存命中后即使删库仍放行，清缓存后失效", async () => {
    const secret = await mint();
    expect(await token.verifyToken(secret)).not.toBeNull();
    await t.db.delete(tokenTable);
    expect(await token.verifyToken(secret)).not.toBeNull();
    token.clearTokenCache();
    expect(await token.verifyToken(secret)).toBeNull();
  });

  it("lastUsedAt 只回写一次", async () => {
    const secret = await mint();
    await token.verifyToken(secret);
    await new Promise((r) => setTimeout(r, 50));
    const [row] = await t.db.select().from(tokenTable);
    expect(row!.lastUsedAt).toBeTruthy();
    const first = row!.lastUsedAt!.getTime();
    token.clearTokenCache();
    await token.verifyToken(secret);
    const [again] = await t.db.select().from(tokenTable);
    expect(again!.lastUsedAt!.getTime()).toBe(first);
  });
});

describe("只读门禁", () => {
  it("read token 打写接口 403，读接口放行", async () => {
    const { deviceRouter } = await import("./content");
    const ctx = asRead();
    await expect(
      call(deviceRouter.create, { name: "x", category: "电脑" }, { context: ctx }),
    ).rejects.toThrow(/只读/);
    await expect(call(deviceRouter.list, undefined, { context: ctx })).resolves.toBeTruthy();
  });

  it("write token 与 cookie 登录都能写", async () => {
    const { deviceRouter } = await import("./content");
    await expect(
      call(deviceRouter.create, { name: "a", category: "电脑" }, { context: asAdmin("write") }),
    ).resolves.toBeTruthy();
    await expect(
      call(deviceRouter.create, { name: "b", category: "电脑" }, { context: asAdmin() }),
    ).resolves.toBeTruthy();
  });
});
