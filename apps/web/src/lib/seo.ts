import { siteConfig } from "@i/config";
import type { MetaDescriptor } from "react-router";

/**
 * 页面 <head> 元信息（取代 Next 的 metadata 合并）。
 * React Router 的 meta 不会继承父路由，所以每个路由调用一次，拿到完整一组：
 * title 模板、description、canonical、OpenGraph / Twitter 卡片、noindex。
 *
 * 绝对地址需要站点 origin：服务端从环境变量读，经 root loader 下发，
 * 客户端导航时从 matches 里取，两端一致。
 */

export const DEFAULT_TITLE = `${siteConfig.title} · 个人空间`;
export const titleOf = (t?: string) => (t ? `${t} · ${siteConfig.title}` : DEFAULT_TITLE);

/** 站点默认分享卡片（Hono 路由渲染，见 src/hono.ts） */
export const DEFAULT_OG_IMAGE = "/og.png";

interface MatchLike {
  id: string;
  loaderData?: unknown;
}

/** root loader 下发的站点 origin */
export function originFrom(matches: readonly (MatchLike | undefined)[]): string {
  const root = matches.find((m) => m?.id === "root")?.loaderData as
    | { siteUrl?: string }
    | undefined;
  return root?.siteUrl ?? siteConfig.url;
}

export interface SeoOptions {
  title?: string;
  description?: string | null;
  /** 站内路径；给了就输出 canonical + og:url */
  path?: string;
  /** 站内路径或绝对地址；缺省用站点默认卡片 */
  image?: string;
  imageAlt?: string;
  type?: "website" | "article";
  publishedTime?: Date | string | null;
  modifiedTime?: Date | string | null;
  tags?: readonly string[] | null;
  noindex?: boolean;
}

export function seo(
  args: { matches: readonly (MatchLike | undefined)[] },
  o: SeoOptions = {},
): MetaDescriptor[] {
  const origin = originFrom(args.matches);
  const abs = (p: string) => (/^https?:\/\//.test(p) ? p : `${origin}${p}`);
  const title = titleOf(o.title);
  const ogTitle = o.title ?? DEFAULT_TITLE;
  const description = o.description ?? siteConfig.description;
  const image = abs(o.image ?? DEFAULT_OG_IMAGE);
  const iso = (d: Date | string) => new Date(d).toISOString();

  const tags: MetaDescriptor[] = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: ogTitle },
    { property: "og:description", content: description },
    { property: "og:site_name", content: siteConfig.title },
    { property: "og:locale", content: "zh_CN" },
    { property: "og:type", content: o.type ?? "website" },
    { property: "og:image", content: image },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: o.imageAlt ?? ogTitle },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: ogTitle },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
  ];
  if (o.path) {
    tags.push({ property: "og:url", content: abs(o.path) });
    tags.push({ tagName: "link", rel: "canonical", href: abs(o.path) });
  }
  if (o.publishedTime)
    tags.push({ property: "article:published_time", content: iso(o.publishedTime) });
  if (o.modifiedTime)
    tags.push({ property: "article:modified_time", content: iso(o.modifiedTime) });
  for (const t of o.tags ?? []) tags.push({ property: "article:tag", content: t });
  if (o.noindex) tags.push({ name: "robots", content: "noindex" });
  return tags;
}
