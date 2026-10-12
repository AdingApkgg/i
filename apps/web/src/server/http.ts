/**
 * 非页面的 HTTP 端点（Hono）。由 src/hono.ts 挂在 React Router 之前：
 *   /api/rpc/*            oRPC
 *   /api/auth/*           better-auth
 *   /api/gallery/*        相册上传 / 读图（MinIO）
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
import { formatDate } from "@/lib/format";
import { renderOgImage } from "@/lib/og";
import { deleteObject, getObject, putObject } from "@/lib/s3";
import { robotsResponse, rssResponse, sitemapResponse } from "./feeds";
import { createContext } from "./orpc";
import { router } from "./router";

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
  const role = (session?.user as { role?: string } | undefined)?.role;
  return role === "admin" || role === "owner";
}

http.post("/api/gallery/upload", async (c) => {
  if (!(await isAdmin(c.req.raw.headers))) return c.json({ error: "unauthorized" }, 401);

  const form = await c.req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return c.json({ error: "missing file" }, 400);

  const type = file.type || "application/octet-stream";
  const ext = EXT[type] ?? file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const key = `${randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    await putObject(key, bytes, type);
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
    await deleteObject(key);
  } catch (e) {
    return c.json({ error: `delete failed: ${String(e)}` }, 500);
  }
  return c.json({ ok: true });
});

http.get("/api/gallery/files/:key", async (c) => {
  try {
    const out = await getObject(c.req.param("key"));
    const bytes = await out.Body?.transformToByteArray();
    if (!bytes) return c.text("not found", 404);
    return new Response(bytes as BodyInit, {
      headers: {
        "content-type": out.ContentType ?? "application/octet-stream",
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return c.text("not found", 404);
  }
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
    .catch(() => []);
  if (!row) return renderOgImage({ eyebrow: "博客", title: siteConfig.tagline });
  const meta = [
    fmtDate(row.publishedAt ?? row.createdAt),
    ...(row.tags ?? []).slice(0, 3).map((t) => `#${t}`),
  ].join("  ·  ");
  return renderOgImage({ eyebrow: "博客", title: row.title, meta });
});
