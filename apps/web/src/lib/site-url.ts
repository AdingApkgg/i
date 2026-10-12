import { siteConfig } from "@i/config";

/** 站点公网 origin（无尾斜杠）。生产由 NEXT_PUBLIC_SITE_URL 覆盖。 */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? siteConfig.url).replace(/\/+$/, "");
}

/**
 * RSS 自动发现（<link rel="alternate">）。子页面一旦设置 alternates（如 canonical）
 * 会整体覆盖根布局的，需要把它一并带上。
 */
export const RSS_ALTERNATE_TYPES = {
  "application/rss+xml": [{ url: "/rss.xml", title: siteConfig.title }],
};

/** 站内路径 → 绝对 URL（sitemap / RSS / OG 需要绝对地址）。 */
export function absUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}
