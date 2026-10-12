import { album, track } from "@i/db/schema";
import { call, ORPCError } from "@orpc/server";
import { asc } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, makeContext } from "../../test/db";
import { albumsRouter, musicRouter } from "./routers/content";
import { galleryRouter } from "./routers/gallery";

vi.mock("@i/db", async () => (await import("../../test/mock-db")).dbModule());
vi.mock("@/lib/auth", () => ({ auth: {} }));

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(() => t.close());
beforeEach(() => t.reset());

const anon = () => ({ context: makeContext(t.db) });
const as = (role: "user" | "admin" | "owner") => ({ context: makeContext(t.db, { role }) });
const rows = () => t.db.select().from(track).orderBy(asc(track.title));

describe("crudRouter 权限", () => {
  it("list 公开可读", async () => {
    await call(musicRouter.create, { title: "a" }, as("admin"));
    await expect(call(musicRouter.list, undefined, anon())).resolves.toHaveLength(1);
  });

  it("未登录写入 → UNAUTHORIZED，且没有落库", async () => {
    await expect(call(musicRouter.create, { title: "x" }, anon())).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    expect(await rows()).toHaveLength(0);
  });

  it("普通用户写入 → FORBIDDEN", async () => {
    await expect(call(musicRouter.create, { title: "x" }, as("user"))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("owner 与 admin 同权", async () => {
    const row = await call(musicRouter.create, { title: "x" }, as("owner"));
    await call(musicRouter.delete, { id: row.id }, as("owner"));
    expect(await rows()).toHaveLength(0);
  });
});

describe("crudRouter create / update / delete", () => {
  it("create：注入默认值，清空的排序（null）归零，生成 id 与时间戳", async () => {
    const row = await call(musicRouter.create, { title: "歌", sortOrder: null }, as("admin"));
    expect(row).toMatchObject({ title: "歌", status: "在听", sortOrder: 0 });
    expect(row.id).toMatch(/^[a-z0-9]{20,}$/);
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.updatedAt).toBeInstanceOf(Date);
  });

  it("update：缺省字段保持原值，不会被默认值悄悄重置（回归）", async () => {
    const row = await call(
      musicRouter.create,
      { title: "旧名", status: "听过", sortOrder: 5 },
      as("admin"),
    );
    await call(musicRouter.update, { id: row.id, title: "新名" }, as("admin"));
    const [after] = await rows();
    expect(after).toMatchObject({ title: "新名", status: "听过", sortOrder: 5 });
  });

  it("update：刷新 updatedAt", async () => {
    const row = await call(musicRouter.create, { title: "a" }, as("admin"));
    await new Promise((r) => setTimeout(r, 5));
    const updated = await call(musicRouter.update, { id: row.id, title: "b" }, as("admin"));
    expect(updated.updatedAt.getTime()).toBeGreaterThan(row.updatedAt.getTime());
  });

  it("update：枚举仍然校验", async () => {
    const row = await call(musicRouter.create, { title: "a" }, as("admin"));
    await expect(
      call(musicRouter.update, { id: row.id, status: "乱填" as never }, as("admin")),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("create：缺必填字段 → BAD_REQUEST 且带 issues", async () => {
    const err = await call(musicRouter.create, {} as never, as("admin")).catch((e) => e);
    expect(err).toBeInstanceOf(ORPCError);
    expect(err.code).toBe("BAD_REQUEST");
    expect(err.data.issues[0].path).toEqual(["title"]);
  });

  it.each(["update", "delete"] as const)("%s 不存在的 id → NOT_FOUND", async (op) => {
    await expect(
      call(musicRouter[op], { id: "nope", title: "x" } as never, as("admin")),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "记录不存在" });
  });

  it("byId 找不到返回 null", async () => {
    await expect(call(musicRouter.byId, { id: "nope" }, anon())).resolves.toBeNull();
  });
});

describe("withDbErrors：Postgres 约束错误 → 语义化错误", () => {
  it("唯一索引冲突（同名图集）→ CONFLICT", async () => {
    await call(albumsRouter.create, { name: "旅行" }, as("admin"));
    await expect(call(albumsRouter.create, { name: "旅行" }, as("admin"))).rejects.toMatchObject({
      code: "CONFLICT",
      message: "已存在同名记录",
    });
  });

  it("外键目标不存在（照片挂到不存在的图集）→ BAD_REQUEST", async () => {
    await expect(
      call(galleryRouter.create, { imageUrl: "https://x/1.jpg", albumId: "nope" }, as("admin")),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "关联的记录不存在（可能已被删除）" });
  });

  it("保留名「未分类」不能用作图集名", async () => {
    await expect(call(albumsRouter.create, { name: "未分类" }, as("admin"))).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(await t.db.select().from(album)).toHaveLength(0);
  });
});

describe("crudRouter page：键集分页", () => {
  it("排序有并列时逐页翻完，不重不漏，顺序与 list 一致", async () => {
    // sortOrder 大量并列，靠 createdAt desc + id asc 打破
    for (const [i, so] of [0, 0, 1, 0, 1, 2, 0].entries()) {
      await call(musicRouter.create, { title: `t${i}`, sortOrder: so }, as("admin"));
    }
    const all = await call(musicRouter.list, undefined, anon());
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const res: { items: { id: string }[]; nextCursor: string | null } = await call(
        musicRouter.page,
        { limit: 3, cursor },
        anon(),
      );
      seen.push(...res.items.map((r) => r.id));
      cursor = res.nextCursor;
    } while (cursor);
    expect(seen).toEqual(all.map((r) => r.id));
  });

  it("游标行已被删除时返回空页", async () => {
    const row = await call(musicRouter.create, { title: "a" }, as("admin"));
    await call(musicRouter.delete, { id: row.id }, as("admin"));
    await expect(call(musicRouter.page, { limit: 3, cursor: row.id }, anon())).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
  });
});

describe("gallery：图集聚合 / 未分类 / 批量操作", () => {
  it("albums 带张数与预览，未分类单独统计；page 按 albumId 过滤", async () => {
    const a = await call(albumsRouter.create, { name: "旅行" }, as("admin"));
    for (let i = 0; i < 3; i++) {
      await call(
        galleryRouter.create,
        { imageUrl: `https://x/a${i}.jpg`, albumId: a.id },
        as("admin"),
      );
    }
    await call(galleryRouter.create, { imageUrl: "https://x/u.jpg" }, as("admin"));

    const res = await call(galleryRouter.albums, { preview: 2 }, anon());
    expect(res.albums[0]).toMatchObject({ name: "旅行", _count: { photos: 3 } });
    expect(res.albums[0]!.photos).toHaveLength(2);
    expect(res.unassigned.count).toBe(1);

    const inAlbum = await call(galleryRouter.page, { limit: 10, albumId: a.id }, anon());
    const loose = await call(galleryRouter.page, { limit: 10, albumId: null }, anon());
    const all = await call(galleryRouter.page, { limit: 10 }, anon());
    expect([inAlbum.items.length, loose.items.length, all.items.length]).toEqual([3, 1, 4]);

    await expect(call(galleryRouter.albumByName, { name: "旅行" }, anon())).resolves.toMatchObject({
      _count: { photos: 3 },
    });
  });

  it("movePhotos / deletePhotos 返回影响行数；删除图集后照片回到未分类", async () => {
    const a = await call(albumsRouter.create, { name: "A" }, as("admin"));
    const p1 = await call(galleryRouter.create, { imageUrl: "https://x/1.jpg" }, as("admin"));
    const p2 = await call(galleryRouter.create, { imageUrl: "https://x/2.jpg" }, as("admin"));
    await expect(
      call(galleryRouter.movePhotos, { ids: [p1.id, p2.id], albumId: a.id }, as("admin")),
    ).resolves.toEqual({ count: 2 });

    await call(albumsRouter.delete, { id: a.id }, as("admin")); // 外键 ON DELETE SET NULL
    const loose = await call(galleryRouter.page, { limit: 10, albumId: null }, anon());
    expect(loose.items).toHaveLength(2);

    await expect(
      call(galleryRouter.deletePhotos, { ids: [p1.id, "nope"] }, as("admin")),
    ).resolves.toEqual({ count: 1 });
  });
});
