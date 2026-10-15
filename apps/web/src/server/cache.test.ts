import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { markDegraded } from "@/lib/degrade.server";
import { CACHE, cachePolicy } from "./cache";

const html = (status = 200) =>
  new Response("<!doctype html>", { status, headers: { "content-type": "text/html" } });

// 模拟真实服务的几类响应；cachePolicy 和生产一样包在最外层
const app = new Hono();
app.use("*", cachePolicy);
app.get(
  "/assets/app-abc123.js",
  () => new Response("", { headers: { "cache-control": "public, max-age=31536000" } }),
);
app.get("/api/gallery/files/:key", () => new Response("", { headers: CACHE.immutable }));
app.get("/rss.xml", () => new Response("", { headers: CACHE.feed }));
app.get(
  "/api/rpc/*",
  () => new Response("{}", { headers: { "content-type": "application/json" } }),
);
app.get("/dash/*", () => html());
app.get(
  "/api/content-export/backup.json",
  () =>
    new Response("{}", {
      headers: {
        "cache-control": "public, max-age=3600, no-transform",
        "cdn-cache-control": "max-age=3600",
      },
    }),
);
app.get("/blog.data", () => new Response("", { headers: { "content-type": "text/x-script" } }));
app.get("/login-cookie", () => {
  const r = html();
  r.headers.set("set-cookie", "a=1");
  return r;
});
app.get("/gone", () => Response.redirect("http://localhost/blog", 301));
app.get("/missing", () => html(404));
// 数据库出错时降级出的空数据 / 兜底内容：路由自己设了缓存头也不能缓存
app.get("/degraded-page", () => {
  markDegraded(new Error("db down"));
  return html();
});
app.get("/degraded-feed", () => {
  markDegraded(new Error("db down"));
  return new Response("", { headers: CACHE.feed });
});
app.on(["GET", "POST"], "/blog", () => html());

const get = async (path: string, method = "GET") => {
  const res = await app.request(path, { method });
  return {
    cc: res.headers.get("cache-control"),
    cdn: res.headers.get("cdn-cache-control"),
    status: res.status,
  };
};

describe("缓存策略", () => {
  it("前台页面与 loader 数据：浏览器每次重新取，CDN 缓存一分钟并允许先回旧版", async () => {
    for (const path of ["/blog", "/blog.data"]) {
      expect(await get(path)).toMatchObject({
        cc: "public, max-age=0, must-revalidate",
        cdn: "max-age=60, stale-while-revalidate=60",
      });
    }
  });

  it("带 hash 的构建产物补上 immutable", async () => {
    expect((await get("/assets/app-abc123.js")).cc).toBe("public, max-age=31536000, immutable");
  });

  it("路由自己设置的缓存头保留（相册文件、RSS）", async () => {
    expect((await get("/api/gallery/files/a.png")).cc).toContain("immutable");
    expect(await get("/rss.xml")).toMatchObject({
      cc: CACHE.feed["cache-control"],
      cdn: CACHE.feed["cdn-cache-control"],
    });
  });

  it("后台、API、写请求、带 Set-Cookie、非 200、降级产物一律不进共享缓存", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const [path, method] of [
      ["/dash/gallery", "GET"],
      ["/api/rpc/blog/list", "GET"],
      ["/blog", "POST"],
      ["/login-cookie", "GET"],
      ["/missing", "GET"],
      ["/degraded-page", "GET"],
      ["/degraded-feed", "GET"],
    ]) {
      expect(await get(path!, method), `${method} ${path}`).toMatchObject({
        cc: "private, no-store",
        cdn: null,
      });
    }
  });

  it("只读响应头（Response.redirect）也能改写，不会抛错", async () => {
    expect(await get("/gone")).toMatchObject({ status: 301, cc: "private, no-store" });
  });

  it("下载接口强制私有且清除 CDN 缓存，同时保留 no-transform", async () => {
    expect(await get("/api/content-export/backup.json")).toMatchObject({
      cc: "private, no-store, no-transform",
      cdn: null,
    });
  });
});
