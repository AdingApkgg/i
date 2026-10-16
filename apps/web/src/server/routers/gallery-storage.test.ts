import { album, device, photo, post } from "@i/db/schema";
import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, makeContext } from "../../../test/db";
import { storedKey } from "../stored-files";
import { thumbKey } from "../thumbs";
import { galleryRouter } from "./gallery";

vi.mock("@i/db", async () => (await import("../../../test/mock-db")).dbModule());
vi.mock("@/lib/auth", () => ({ auth: {} }));

// 内存版对象存储：记录还在的 key
const files = vi.hoisted(() => new Set<string>());
const fail = vi.hoisted(() => ({ delete: false }));
vi.mock("@/lib/s3", () => ({
  storage: {
    async delete(key: string) {
      if (fail.delete) throw new Error("storage down");
      files.delete(key);
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
  fail.delete = false;
});

const admin = () => ({ context: makeContext(t.db, { role: "admin" }) });
const url = (key: string) => `/api/gallery/files/${key}`;

/** 存一张图（原图 + 两档缩略图）并建照片记录 */
async function seedPhoto(key: string, extra: Partial<typeof photo.$inferInsert> = {}) {
  files.add(key);
  files.add(thumbKey(key, 320));
  files.add(thumbKey(key, 640));
  const [row] = await t.db
    .insert(photo)
    .values({ imageUrl: url(key), ...extra })
    .returning();
  return row!;
}
const hasAny = (key: string) => [...files].some((f) => f === key || f.includes(`/${key}.webp`));

describe("删除照片时回收存储", () => {
  it("删除照片：原图和各档缩略图一起删掉", async () => {
    const p = await seedPhoto("a.png");
    await call(galleryRouter.delete, { id: p.id }, admin());
    expect(hasAny("a.png")).toBe(false);
  });

  it("批量删除：多张照片的文件都回收", async () => {
    const a = await seedPhoto("a.png");
    const b = await seedPhoto("b.jpg", { thumbUrl: url("b-thumb.jpg") });
    files.add("b-thumb.jpg");
    files.add("keep.png");
    await call(galleryRouter.deletePhotos, { ids: [a.id, b.id] }, admin());
    expect([...files]).toEqual(["keep.png"]);
  });

  it("还被别处引用的文件保留：图集封面、文章正文、另一张照片", async () => {
    const cover = await seedPhoto("cover.png");
    await t.db.insert(album).values({ name: "旅行", coverUrl: url("cover.png") });
    const inPost = await seedPhoto("in-post.png");
    await t.db.insert(post).values({
      slug: "p",
      title: "p",
      contentMd: `看图 ![](${url("in-post.png")}?w=640)`,
    });
    const dup = await seedPhoto("dup.png");
    await seedPhoto("dup.png");

    await call(galleryRouter.deletePhotos, { ids: [cover.id, inPost.id, dup.id] }, admin());
    expect(hasAny("cover.png")).toBe(true);
    expect(hasAny("in-post.png")).toBe(true);
    expect(hasAny("dup.png")).toBe(true);
  });

  it.each(["delete", "replace"] as const)(
    "设备仍引用图片时，照片 %s 保留原图和缩略图",
    async (operation) => {
      const p = await seedPhoto("device-shared.png");
      await t.db.insert(device).values({ name: "Laptop", imageUrl: url("device-shared.png") });
      if (operation === "delete") await call(galleryRouter.delete, { id: p.id }, admin());
      else
        await call(galleryRouter.update, { id: p.id, imageUrl: url("replacement.png") }, admin());
      expect(files.has("device-shared.png")).toBe(true);
      expect(files.has(thumbKey("device-shared.png", 320))).toBe(true);
      expect(files.has(thumbKey("device-shared.png", 640))).toBe(true);
    },
  );

  it("key 里的 LIKE 通配符按字面匹配，不会把别的引用误算进来", async () => {
    const p = await seedPhoto("a_b.png");
    // 只有通配符意义上能匹配 a_b.png 的另一个文件被引用
    await t.db.insert(album).values({ name: "x", coverUrl: url("axb.png") });
    await call(galleryRouter.delete, { id: p.id }, admin());
    expect(hasAny("a_b.png")).toBe(false);
  });

  it("换图：旧文件回收，新文件保留", async () => {
    const p = await seedPhoto("old.png");
    files.add("new.png");
    await call(galleryRouter.update, { id: p.id, imageUrl: url("new.png") }, admin());
    expect(hasAny("old.png")).toBe(false);
    expect(files.has("new.png")).toBe(true);

    // 只改标题不动图：什么都不删
    await call(galleryRouter.update, { id: p.id, title: "改个名" }, admin());
    expect(files.has("new.png")).toBe(true);
  });

  it("key 带 %xx 编码：引用检查按库里的写法搜，删除时解码；编码不合法也不报错", async () => {
    // 两张照片共用编码过的地址：删一张，文件保留
    const a = await seedPhoto("a b.jpg", { imageUrl: url("a%20b.jpg") });
    await seedPhoto("a b.jpg", { imageUrl: url("a%20b.jpg") });
    await call(galleryRouter.delete, { id: a.id }, admin());
    expect(files.has("a b.jpg")).toBe(true);

    const bad = await seedPhoto("a%zz.jpg", { imageUrl: url("a%zz.jpg") });
    await expect(call(galleryRouter.delete, { id: bad.id }, admin())).resolves.toBeTruthy();
    expect(hasAny("a%zz.jpg")).toBe(false);
  });

  it("外链图片不碰存储", async () => {
    const [p] = await t.db
      .insert(photo)
      .values({ imageUrl: "https://example.com/a.png" })
      .returning();
    files.add("a.png");
    await call(galleryRouter.delete, { id: p!.id }, admin());
    expect(files.has("a.png")).toBe(true);
  });

  it("存储出错不影响删除本身（只记日志）", async () => {
    const p = await seedPhoto("a.png");
    fail.delete = true;
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(call(galleryRouter.delete, { id: p.id }, admin())).resolves.toMatchObject({
      id: p.id,
    });
    expect(await t.db.$count(photo)).toBe(0);
  });
});

describe("storedKey", () => {
  it("只认站内存储地址，去掉查询参数", () => {
    expect(storedKey("/api/gallery/files/a.png")).toBe("a.png");
    expect(storedKey("/api/gallery/files/a.png?w=640")).toBe("a.png");
    expect(storedKey("/api/gallery/files/a%20b.png")).toBe("a%20b.png");
    expect(storedKey("https://x.com/api/gallery/files/a.png")).toBeNull();
    expect(storedKey("/api/gallery/files/")).toBeNull();
    expect(storedKey(null)).toBeNull();
  });
});
