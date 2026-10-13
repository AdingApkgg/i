/**
 * 非页面的 HTTP 端点（Hono）。由 src/hono.ts 挂在 React Router 之前：
 *   /api/rpc/*            oRPC
 *   /api/auth/*           better-auth
 *   /api/gallery/*        相册上传 / 读图 / 缩略图（SeaweedFS S3 + sharp）
 *   /rss.xml /sitemap.xml /robots.txt
 *   /og.png /og/blog/:slug.png   分享卡片
 */
import { randomUUID } from "node:crypto";
import { siteConfig } from "@i/config";
import { db, post } from "@i/db";
import { ORPCError, onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { auth } from "@/lib/auth";
import { degradeTo } from "@/lib/degrade.server";
import { formatDate } from "@/lib/format";
import { renderOgImage } from "@/lib/og";
import { isAdminRole } from "@/lib/roles";
import { StorageError, storage } from "@/lib/s3";
import { isThumbWidth } from "@/lib/thumb";
import { CACHE } from "./cache";
import { robotsResponse, rssResponse, sitemapResponse } from "./feeds";
import { createContext } from "./orpc";
import { router } from "./router";
import { deleteThumbs, getThumb } from "./thumbs";

export const http = new Hono();

// ---------------- oRPC ----------------

const rpc = new RPCHandler(router, {
  interceptors: [
    onError((error) => {
      // 业务错误（ORPCError 4xx）是预期内的，只打意外异常
      if (error instanceof ORPCError && error.status < 500) return;
      console.error("[orpc]", error);
    }),
  ],
});

http.all("/api/rpc/*", async (c) => {
  const { matched, response } = await rpc.handle(c.req.raw, {
    prefix: "/api/rpc",
    context: await createContext({ headers: c.req.raw.headers }),
  });
  return matched ? response : c.text("Not found", 404);
});

// ---------------- better-auth ----------------

http.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// ---------------- 相册：上传 / 删除 / 读图 ----------------

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/svg+xml": "svg",
};

async function isAdmin(headers: Headers) {
  const session = await auth.api.getSession({ headers }).catch(() => null);
  return isAdminRole(session?.user);
}

http.post("/api/gallery/upload", async (c) => {
  if (!(await isAdmin(c.req.raw.headers))) return c.json({ error: "unauthorized" }, 401);

  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return c.json({ error: "missing file" }, 400);

  const type = file.type || "application/octet-stream";
  const ext =
    EXT[type] ??
    (file.name
      .split(".")
      .pop()
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "") ||
      "bin");
  const key = `${randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    await storage.put(key, bytes, type);
  } catch (e) {
    return c.json({ error: `upload failed: ${String(e)}` }, 500);
  }
  return c.json({ imageUrl: `/api/gallery/files/${key}` });
});

/** 批量上传里 create 失败时的善后：按 key 删掉刚传的对象，避免存储孤儿 */
http.delete("/api/gallery/upload", async (c) => {
  if (!(await isAdmin(c.req.raw.headers))) return c.json({ error: "unauthorized" }, 401);
  const key = c.req.query("key");
  // key 是 upload 生成的 `${uuid}.${ext}`，拒绝路径分隔符防目录逃逸
  if (!key || key.includes("/") || key.includes("\\")) return c.json({ error: "bad key" }, 400);
  try {
    await storage.delete(key);
    await deleteThumbs(key);
  } catch (e) {
    if (e instanceof StorageError && e.status === 400) return c.json({ error: "bad key" }, 400);
    return c.json({ error: `delete failed: ${String(e)}` }, 500);
  }
  return c.json({ ok: true });
});

/** ?w=640 等取缩略图（宽度见 lib/thumb.ts），不带参数取原图 */
http.get("/api/gallery/files/:key", async (c) => {
  const key = c.req.param("key");
  const w = c.req.query("w");
  if (w !== undefined && !isThumbWidth(Number(w))) {
    return c.text("unsupported width", 400);
  }
  let obj: Response | null;
  try {
    const t = w === undefined ? null : await getThumb(key, Number(w));
    if (t) return t;
    obj = await storage.get(key);
  } catch (e) {
    if (e instanceof StorageError && e.status === 400) return c.text("not found", 404);
    console.error("[gallery] read failed:", e);
    return c.text("storage error", 502);
  }
  if (!obj) return c.text("not found", 404);
  // 流式转发，不在内存里攒整张图；key 带 uuid，内容不变，可长期缓存
  return new Response(obj.body, {
    headers: {
      "content-type": obj.headers.get("content-type") ?? "application/octet-stream",
      ...(obj.headers.get("content-length")
        ? { "content-length": obj.headers.get("content-length")! }
        : {}),
      ...CACHE.immutable,
    },
  });
});

// ---------------- 订阅 / 抓取 ----------------

http.get("/rss.xml", () => rssResponse());
http.get("/sitemap.xml", () => sitemapResponse());
http.get("/robots.txt", () => robotsResponse());

// ---------------- 分享卡片 ----------------

http.get("/og.png", () => renderOgImage({ eyebrow: "个人空间", title: siteConfig.tagline }));

const fmtDate = (d: Date) => formatDate(d, { dateStyle: "long" });

http.get("/og/blog/:file{.+\\.png}", async (c) => {
  const slug = c.req.param("file").replace(/\.png$/, "");
  const [row] = await db
    .select({
      title: post.title,
      tags: post.tags,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
    })
    .from(post)
    .where(eq(post.slug, slug))
    .catch(degradeTo([]));
  // 不存在的 slug 不现画（随便拼的 URL 都要渲染一次很费 CPU），跳到全站通用卡片
  if (!row) return c.redirect("/og.png", 302);
  const meta = [
    fmtDate(row.publishedAt ?? row.createdAt),
    ...(row.tags ?? []).slice(0, 3).map((t) => `#${t}`),
  ].join("  ·  ");
  return renderOgImage({ eyebrow: "博客", title: row.title, meta });
});
