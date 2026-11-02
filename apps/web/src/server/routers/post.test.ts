import { monitor, post } from "@i/db/schema";
import { call } from "@orpc/server";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, makeContext } from "../../../test/db";
import { monitorRouter } from "./monitor";
import { postRouter } from "./post";

vi.mock("@i/db", async () => (await import("../../../test/mock-db")).dbModule());
vi.mock("@/lib/auth", () => ({ auth: {} }));

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(() => t.close());
beforeEach(() => t.reset());

const admin = () => ({ context: makeContext(t.db, { role: "admin" }) });
const getPost = (id: string) =>
  t.db
    .select()
    .from(post)
    .where(eq(post.id, id))
    .then((r) => r[0]!);

const OLD_DATE = new Date("2021-05-01T08:00:00.000Z");

const doc = (text: string) => ({
  type: "doc" as const,
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

/** 模拟从旧博客导入的已发布文章：带标签、带原始发布日期 */
const seedImported = () =>
  t.db
    .insert(post)
    .values({
      slug: "imported",
      title: "旧文章",
      contentMd: "正文",
      tags: ["随笔", "生活"],
      status: "published",
      publishedAt: OLD_DATE,
    })
    .returning()
    .then((r) => r[0]!);

describe("blog.list", () => {
  const seed = () =>
    t.db.insert(post).values([
      {
        slug: "pub",
        title: "已发布",
        contentMd: "正文 A",
        status: "published",
        publishedAt: OLD_DATE,
      },
      { slug: "draft", title: "草稿", contentMd: "正文 B", status: "draft" },
    ]);
  const anon = () => ({ context: makeContext(t.db) });

  it("公开列表：只有已发布文章，且不带正文（loader 数据会进 HTML）", async () => {
    await seed();
    const rows = await call(postRouter.list, undefined, anon());
    expect(rows.map((r) => r.slug)).toEqual(["pub"]);
    expect(rows[0]).not.toHaveProperty("contentMd");
    expect(rows[0]).not.toHaveProperty("content");
  });

  it("includeDrafts：访客 / 普通用户 FORBIDDEN，管理员拿到含草稿的列表（同样不带正文）", async () => {
    await seed();
    await expect(call(postRouter.list, { includeDrafts: true }, anon())).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      call(
        postRouter.list,
        { includeDrafts: true },
        { context: makeContext(t.db, { role: "user" }) },
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const rows = await call(postRouter.list, { includeDrafts: true }, admin());
    expect(rows.map((r) => r.slug).sort()).toEqual(["draft", "pub"]);
    expect(rows.find((r) => r.slug === "draft")).not.toHaveProperty("content");
    expect(rows.find((r) => r.slug === "draft")).not.toHaveProperty("contentMd");
  });
});

describe("blog.update", () => {
  it("后台编辑表单（不含 tags 字段）保存后，标签和原始发布日期都保留", async () => {
    const p = await seedImported();
    // /dash 通用编辑器提交的就是这些字段：没有 tags，status 原样带上
    await call(
      postRouter.update,
      {
        id: p.id,
        slug: "imported",
        title: "旧文章（修了错别字）",
        excerpt: "",
        content: doc("正文"),
        coverUrl: "",
        status: "published",
      },
      admin(),
    );
    const after = await getPost(p.id);
    expect(after.title).toBe("旧文章（修了错别字）");
    expect(after.tags).toEqual(["随笔", "生活"]);
    expect(after.publishedAt).toEqual(OLD_DATE);
  });

  it("只改标题、不带 status 时不会被打回草稿", async () => {
    const p = await seedImported();
    await call(postRouter.update, { id: p.id, title: "新标题" }, admin());
    expect(await getPost(p.id)).toMatchObject({ title: "新标题", status: "published" });
  });

  it("草稿首次发布时写入发布时间；之后再保存不再改动", async () => {
    const draft = await call(
      postRouter.create,
      { slug: "draft", title: "草稿", content: doc("x") },
      admin(),
    );
    expect(draft).toMatchObject({ status: "draft", publishedAt: null, tags: [] });

    const published = await call(postRouter.update, { id: draft.id, status: "published" }, admin());
    expect(published.publishedAt).toBeInstanceOf(Date);

    await new Promise((r) => setTimeout(r, 5));
    const resaved = await call(
      postRouter.update,
      { id: draft.id, title: "改个标题", status: "published" },
      admin(),
    );
    expect(resaved.publishedAt).toEqual(published.publishedAt);
  });

  it("显式传 tags 时照常更新", async () => {
    const p = await seedImported();
    await call(postRouter.update, { id: p.id, tags: ["新标签"] }, admin());
    expect((await getPost(p.id)).tags).toEqual(["新标签"]);
  });
});

describe("blog 正文（富文本）", () => {
  it("byId 只给管理员，返回完整正文", async () => {
    const p = await call(
      postRouter.create,
      { slug: "a", title: "A", content: doc("你好") },
      admin(),
    );
    await expect(
      call(postRouter.byId, { id: p.id }, { context: makeContext(t.db) }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const row = await call(postRouter.byId, { id: p.id }, admin());
    expect(row.content).toEqual(doc("你好"));
  });

  it("不符合 schema 的正文被拒绝", async () => {
    const bad = { type: "doc", content: [{ type: "notANode" }] };
    await expect(
      call(postRouter.create, { slug: "b", title: "B", content: bad as never }, admin()),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      call(
        postRouter.create,
        { slug: "b", title: "B", content: { type: "paragraph" } as never },
        admin(),
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("没填摘要时从正文生成", async () => {
    const p = await call(
      postRouter.create,
      { slug: "c", title: "C", content: doc("这是第一段正文"), excerpt: "" },
      admin(),
    );
    expect(p.excerpt).toBe("这是第一段正文");
  });
});

describe("monitor.update", () => {
  it("部分更新不会把已停用的监控重新启用、也不重置类型和间隔", async () => {
    const [m] = await t.db
      .insert(monitor)
      .values({ name: "db", target: "db:5432", kind: "tcp", intervalSec: 300, enabled: false })
      .returning();
    await call(monitorRouter.update, { id: m!.id, name: "数据库" }, admin());
    const [after] = await t.db.select().from(monitor);
    expect(after).toMatchObject({ name: "数据库", kind: "tcp", intervalSec: 300, enabled: false });
  });
});
