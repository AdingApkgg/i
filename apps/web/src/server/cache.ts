/**
 * 统一的缓存策略（浏览器 + Cloudflare 等 CDN）。
 *
 * - Cache-Control 给浏览器，CDN-Cache-Control 给 CDN（RFC 9213；Cloudflare 优先看它）。
 *   页面让 CDN 缓存一小会儿、过期后先回旧版并在后台刷新（stale-while-revalidate），浏览器则每次都要新的。
 *   不用 s-maxage：Cloudflare 把它当 proxy-revalidate，会让 stale-while-revalidate 失效。
 * - 只有和登录状态无关的响应才标 public：前台页面的登录态在客户端获取（useSession），
 *   loader 输出对所有人一样；后台 / API / 带 Set-Cookie 的响应一律 private, no-store。
 * - 数据库出错时降级出来的响应（lib/degrade.server.ts 标记）不缓存。
 *
 * Cloudflare 侧需要一条 Cache Rule 让页面可缓存，见 README「Cloudflare 缓存」。
 */
import { createMiddleware } from "hono/factory";
import { isDegraded, withRequestState } from "@/lib/degrade.server";

export const CACHE = {
  /** 内容不变的文件：带 hash 的构建产物、相册原图 / 缩略图（key 含 uuid） */
  immutable: { "cache-control": "public, max-age=31536000, immutable" },
  /**
   * 前台页面与其 loader 数据（.data）：CDN 缓存 1 分钟，过期后 1 分钟内先回旧版。
   * stale 窗口刻意短：部署后旧 HTML 引用的旧 chunk 已经不在了（另见 README：部署后清 CDN 缓存）
   */
  page: {
    "cache-control": "public, max-age=0, must-revalidate",
    "cdn-cache-control": "max-age=60, stale-while-revalidate=60",
  },
  /** RSS / sitemap */
  feed: {
    "cache-control": "public, max-age=600",
    "cdn-cache-control": "max-age=3600, stale-while-revalidate=86400",
  },
  /** 分享卡片：生成开销大、改动少 */
  og: {
    "cache-control": "public, max-age=3600",
    "cdn-cache-control": "max-age=86400, stale-while-revalidate=604800",
  },
  none: { "cache-control": "private, no-store" },
} satisfies Record<string, Record<string, string>>;

export type CachePolicy = keyof typeof CACHE;

function write(headers: Headers, policy: CachePolicy) {
  headers.delete("cdn-cache-control");
  for (const [k, v] of Object.entries(CACHE[policy])) headers.set(k, v);
}

/** 不随登录状态变化、但也不该进共享缓存的路径（后台、各类 API；相册文件除外） */
const isPrivatePath = (path: string) =>
  path === "/dash" ||
  path.startsWith("/dash/") ||
  path.startsWith("/dash.") ||
  (path.startsWith("/api/") && !path.startsWith("/api/gallery/files/"));

/**
 * 包在所有处理之外（react-router-hono-server 的 beforeAll），在响应发出前补齐缓存头：
 * 路由自己设置过的（相册文件、RSS、分享卡片等）保留，其余按路径 / 状态码归类。
 */
export const cachePolicy = createMiddleware(async (c, next) => {
  let degraded = false;
  await withRequestState(async () => {
    await next();
    degraded = isDegraded();
  });
  const { path, method } = c.req;
  const headers = c.res.headers;
  const apply = (policy: CachePolicy) => {
    try {
      write(c.res.headers, policy);
    } catch {
      // Response.redirect() / fetch 回来的响应头只读：复制一份再改
      c.res = new Response(c.res.body, c.res);
      write(c.res.headers, policy);
    }
  };

  // 降级产物（数据库出错时的空数据、兜底卡片）：即使路由设了缓存头也不缓存
  if (
    (method !== "GET" && method !== "HEAD") ||
    headers.has("set-cookie") ||
    isPrivatePath(path) ||
    degraded
  ) {
    return apply("none");
  }
  // 构建产物带内容 hash（react-router-hono-server 默认只给了 max-age）
  if (path.startsWith("/assets/") && c.res.ok) return apply("immutable");
  if (headers.has("cache-control")) return;

  const type = headers.get("content-type") ?? "";
  const isPage = type.startsWith("text/html") || path.endsWith(".data");
  apply(isPage && c.res.status === 200 ? "page" : "none");
});
