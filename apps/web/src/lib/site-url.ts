import { siteConfig } from "@i/config";

/**
 * 站点公网 origin（无尾斜杠），仅服务端使用。
 * SITE_URL 优先；NEXT_PUBLIC_SITE_URL 是 Next 时代的变量名，保留兼容已部署的 .env；
 * 都没设时用 BETTER_AUTH_URL（同源部署，二者是同一个 origin）。
 */
export function siteUrl(): string {
  const env =
    process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.BETTER_AUTH_URL;
  return (env || siteConfig.url).replace(/\/+$/, "");
}

/** 站内路径 → 绝对 URL（sitemap / RSS / OG 需要绝对地址）。 */
export function absUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
