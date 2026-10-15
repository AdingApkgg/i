import { page, post } from "@i/db/schema";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "../../test/db";
import { contentExportRoutes } from "./content-export";

vi.mock("@i/db", async () => (await import("../../test/mock-db")).dbModule());
const getSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession } } }));

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(() => t.close());
beforeEach(async () => {
  await t.reset();
  getSession.mockResolvedValue({ user: { role: "admin" } });
});
const app = () => contentExportRoutes(t.db);
const doc = {
  type: "doc" as const,
  content: [{ type: "paragraph", content: [{ type: "text", text: "测试正文" }] }],
};

describe("管理员内容下载", () => {
  it("匿名和普通用户不能下载全量备份或草稿正文", async () => {
    for (const session of [null, { user: { role: "user" } }]) {
      getSession.mockResolvedValue(session);
      for (const path of ["/backup.json", "/post/id.json", "/post/id.html", "/page/music.html"]) {
        const response = await app().request(path);
        expect(response.status).toBe(session ? 403 : 401);
        expect(response.headers.get("cache-control")).toBe("private, no-store, no-transform");
      }
    }
  });

  it("全量 JSON 包含草稿和整页，下载声明与缓存头正确", async () => {
    await t.db.insert(post).values({ id: "draft", title: "草稿", slug: "draft", content: doc });
    await t.db.insert(page).values({ id: "music", title: "音乐", content: doc });
    const response = await app().request("/backup.json");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("content-disposition")).toMatch(/^attachment;/);
    expect(response.headers.get("cache-control")).toBe("private, no-store, no-transform");
    expect(await response.json()).toMatchObject({
      posts: [{ slug: "draft", status: "draft", content: doc }],
      pages: [{ id: "music", content: doc }],
    });
  });

  it("单篇 JSON 只导出指定记录，单页 HTML 包含保存正文", async () => {
    await t.db.insert(post).values([
      { id: "a", title: "A", slug: "a", content: doc },
      { id: "b", title: "B", slug: "b", content: doc },
    ]);
    await t.db.insert(page).values({ id: "music", title: "音乐", content: doc });
    const json = await app().request("/post/a.json");
    const backup = await json.json();
    expect(backup.posts).toHaveLength(1);
    expect(backup.posts[0].id).toBe("a");
    expect(backup.pages).toEqual([]);
    const html = await app().request("/page/music.html");
    expect(html.headers.get("content-type")).toBe("application/octet-stream");
    expect(html.headers.get("cache-control")).toBe("private, no-store, no-transform");
    expect(html.headers.get("content-disposition")).toContain("page-music.html");
    expect(await html.text()).toContain("测试正文");
  });

  it("不存在的文档返回404，不支持的格式返回400", async () => {
    expect((await app().request("/post/missing.html")).status).toBe(404);
    expect((await app().request("/page/music.txt")).status).toBe(400);
  });
});
