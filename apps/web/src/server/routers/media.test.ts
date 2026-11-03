import { comment, device, photo, post } from "@i/db/schema";
import { call } from "@orpc/server";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, makeContext } from "../../../test/db";
import { mediaRouter as media } from "./media";

vi.mock("@i/db", async () => (await import("../../../test/mock-db")).dbModule());
vi.mock("@/lib/auth", () => ({ auth: {} }));

/** 内存版对象存储：key → 大小 + 上传时间 */
const files = vi.hoisted(() => new Map<string, { size: number; at: string }>());
vi.mock("@/lib/s3", () => ({
  storage: {
    async *list() {
      for (const [key, meta] of files) yield { key, size: meta.size, lastModified: meta.at };
    },
    async head(key: string) {
      const meta = files.get(key);
      return meta === undefined ? null : { size: meta.size };
    },
    async delete(key: string) {
      files.delete(key);
    },
    async put(key: string, body: Uint8Array | ArrayBuffer) {
      files.set(key, { size: body.byteLength, at: new Date().toISOString() });
    },
  },
}));

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(() => t.close());
beforeEach(async () => {
  await t.reset();
  files.clear();
});

const admin = () => ({ context: makeContext(t.db, { role: "admin" }) });
const url = (key: string) => `/api/gallery/files/${key}`;
const put = (key: string, size = 1000, at = "2026-01-01T00:00:00.000Z") =>
  files.set(key, { size, at });

describe("媒体库", () => {
  it("非管理员不能访问", async () => {
    await expect(call(media.list, {}, { context: makeContext(t.db) })).rejects.toThrow();
  });

  it("列表把已引用对象标为 used，并带出引用来源", async () => {
    put("a.png");
    put("b.webp");
    await t.db.insert(device).values({ name: "手机", category: "phone", imageUrl: url("a.png") });

    const res = await call(media.list, {}, admin());
    const byKey = new Map(res.items.map((i) => [i.key, i]));
    expect(byKey.get("a.png")?.used).toBe(true);
    expect(byKey.get("a.png")?.refs).toHaveLength(1);
    expect(byKey.get("a.png")?.refs[0]).toMatchObject({ table: "Device", label: "手机" });
    expect(byKey.get("b.webp")?.used).toBe(false);
  });

  it("缩略图不单独成项，只列原图", async () => {
    put("a.png");
    put("thumbs/w320/a.png.webp");

    const res = await call(media.list, {}, admin());
    expect(res.items.map((i) => i.key)).toEqual(["a.png"]);
  });

  it("按类型和用途筛选", async () => {
    put("a.png");
    put("v.mp4");
    await t.db.insert(photo).values({ imageUrl: url("a.png") });

    const images = await call(media.list, { type: "image" }, admin());
    expect(images.items.map((i) => i.key)).toEqual(["a.png"]);
    const orphans = await call(media.list, { usage: "orphan" }, admin());
    expect(orphans.items.map((i) => i.key)).toEqual(["v.mp4"]);
    const used = await call(media.list, { usage: "used" }, admin());
    expect(used.items.map((i) => i.key)).toEqual(["a.png"]);
  });

  it("关键字过滤 key", async () => {
    put("aaa111.png");
    put("bbb222.png");
    const res = await call(media.list, { q: "aaa" }, admin());
    expect(res.items.map((i) => i.key)).toEqual(["aaa111.png"]);
  });

  it("关键字也搜引用来源标题", async () => {
    put("aaa111.png");
    put("bbb222.png");
    await t.db.insert(post).values({ slug: "p", title: "夏天去看海", coverUrl: url("bbb222.png") });

    const res = await call(media.list, { q: "看海" }, admin());
    expect(res.items.map((i) => i.key)).toEqual(["bbb222.png"]);
  });

  it("默认按最近上传倒序，可切换大小 / 引用数 / key 排序", async () => {
    put("old.png", 10, "2026-01-01T00:00:00.000Z");
    put("mid.png", 300, "2026-02-01T00:00:00.000Z");
    put("new.png", 20, "2026-03-01T00:00:00.000Z");
    await t.db.insert(post).values({ slug: "p", title: "t", coverUrl: url("new.png") });

    const keys = async (sort: "newest" | "oldest" | "largest" | "smallest" | "refs" | "key") =>
      (await call(media.list, { sort }, admin())).items.map((i) => i.key);
    expect(await keys("newest")).toEqual(["new.png", "mid.png", "old.png"]);
    expect(await keys("oldest")).toEqual(["old.png", "mid.png", "new.png"]);
    expect(await keys("largest")).toEqual(["mid.png", "new.png", "old.png"]);
    expect(await keys("smallest")).toEqual(["old.png", "new.png", "mid.png"]);
    expect((await keys("refs"))[0]).toBe("new.png");
    expect(await keys("key")).toEqual(["mid.png", "new.png", "old.png"]);
  });

  it("按最小体积筛选，便于找大文件", async () => {
    put("small.png", 10);
    put("big.webp", 5_000_000);

    const res = await call(media.list, { minBytes: 1_000_000 }, admin());
    expect(res.items.map((i) => i.key)).toEqual(["big.webp"]);
  });

  it("分页用 offset，next 给出下一页起点", async () => {
    for (let n = 0; n < 61; n++) put(`k${String(n).padStart(3, "0")}.png`, n);

    const first = await call(media.list, { sort: "key" }, admin());
    expect(first.items).toHaveLength(60);
    expect(first.next).toBe(60);
    const second = await call(media.list, { sort: "key", offset: first.next! }, admin());
    expect(second.items.map((i) => i.key)).toEqual(["k060.png"]);
    expect(second.next).toBeUndefined();
  });

  it("统计给出类型分布与最大文件", async () => {
    put("a.png", 100);
    put("v.mp4", 9000);
    put("b.webp", 300);

    const res = await call(media.stats, {}, admin());
    expect(res.byType).toMatchObject({ image: 2, video: 1 });
    expect(res.largest[0]).toMatchObject({ key: "v.mp4", size: 9000, type: "video" });
    expect(res.largest).toHaveLength(3);
  });

  it("引用来源给中文表名，评论指向所属文章", async () => {
    put("a.png");
    const [u] = await t.db
      .execute(
        sql`insert into "User" ("id", "email", "createdAt", "updatedAt") values ('u-c', 'c@example.com', now(), now()) returning "id"`,
      )
      .then((r) => r.rows as { id: string }[]);
    const [p] = await t.db.insert(post).values({ slug: "hai", title: "海" }).returning();
    await t.db
      .insert(comment)
      .values({ path: "/blog/hai", userId: u!.id, postId: p!.id, contentMd: `图 ${url("a.png")}` });

    const d = await call(media.detail, { key: "a.png" }, admin());
    const ref = d!.refs.find((r) => r.table === "Comment")!;
    expect(ref.source).toBe("评论");
    expect(ref.href).toBe("/blog/hai");
  });

  it("统计给出总数、占用与孤儿数", async () => {
    put("a.png", 100);
    put("b.webp", 250);
    await t.db.insert(photo).values({ imageUrl: url("a.png") });

    expect(await call(media.stats, {}, admin())).toMatchObject({
      files: 2,
      bytes: 350,
      orphans: 1,
      orphanBytes: 250,
    });
  });

  it("详情带出引用来源，未引用为空数组", async () => {
    put("a.png", 42);
    await t.db.insert(post).values({ slug: "p", title: "文章", coverUrl: url("a.png") });

    const d = await call(media.detail, { key: "a.png" }, admin());
    expect(d).toMatchObject({ key: "a.png", size: 42, type: "image" });
    expect(d!.refs[0]).toMatchObject({ table: "Post", label: "文章" });

    put("b.png");
    expect((await call(media.detail, { key: "b.png" }, admin()))!.refs).toEqual([]);
  });

  it("删除孤儿：对象和缩略图一起删", async () => {
    put("a.png");
    put("thumbs/w320/a.png.webp");
    const res = await call(media.remove, { keys: ["a.png"] }, admin());
    expect(res).toEqual({ deleted: ["a.png"], kept: [] });
    expect([...files.keys()]).toEqual([]);
  });

  it("删除仍在引用的对象：默认保留，force 才删", async () => {
    put("a.png");
    await t.db.insert(photo).values({ imageUrl: url("a.png") });

    expect(await call(media.remove, { keys: ["a.png"] }, admin())).toMatchObject({
      deleted: [],
      kept: ["a.png"],
    });
    expect(files.has("a.png")).toBe(true);

    await call(media.remove, { keys: ["a.png"], force: true }, admin());
    expect(files.has("a.png")).toBe(false);
  });

  it("删除不存在的 key 不报错", async () => {
    expect(await call(media.remove, { keys: ["ghost.png"] }, admin())).toEqual({
      deleted: [],
      kept: [],
    });
  });

  it("替换：所有引用改成新地址，旧对象删掉", async () => {
    put("old.png");
    put("new.png");
    const [p] = await t.db
      .insert(photo)
      .values({ imageUrl: url("old.png") })
      .returning();
    const [d] = await t.db
      .insert(device)
      .values({ name: "机", category: "phone", imageUrl: url("old.png") })
      .returning();
    const [b] = await t.db
      .insert(post)
      .values({
        slug: "p",
        title: "文",
        contentMd: `前 ![x](${url("old.png")}) 后`,
        content: { json: url("old.png") } as never,
      })
      .returning();

    const res = await call(media.replace, { key: "old.png", newKey: "new.png" }, admin());
    expect(res.updated).toBeGreaterThanOrEqual(3);

    const [p2] = await t.db.select().from(photo);
    const [d2] = await t.db.select().from(device);
    const [b2] = await t.db.select().from(post);
    expect(p2!.imageUrl).toBe(url("new.png"));
    expect(d2!.imageUrl).toBe(url("new.png"));
    expect(b2!.contentMd).toBe(`前 ![x](${url("new.png")}) 后`);
    expect(JSON.stringify(b2!.content)).toContain(url("new.png"));
    expect(p!.id && d!.id && b!.id).toBeTruthy();
    expect(files.has("old.png")).toBe(false);
    expect(files.has("new.png")).toBe(true);
  });

  it("替换到新内容：新文件不存在时先报错不落库", async () => {
    put("old.png");
    await t.db.insert(photo).values({ imageUrl: url("old.png") });

    await expect(
      call(media.replace, { key: "old.png", newKey: "ghost.png" }, admin()),
    ).rejects.toThrow();
    const [p] = await t.db.select().from(photo);
    expect(p!.imageUrl).toBe(url("old.png"));
  });
});
