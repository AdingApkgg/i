/**
 * 订阅 / 抓取用的纯文本端点：RSS、sitemap、robots（由 Hono 直接响应，见 server/http.ts）。
 * 内容在库里，每次请求现查；绝对地址取运行时的 SITE_URL。
 */
import { DOMAINS, siteConfig } from "@i/config";
import { album, db, post } from "@i/db";
import { desc, eq } from "drizzle-orm";
import { absUrl } from "@/lib/site-url";
import { CACHE } from "./cache";

const FEED_SIZE = 30;

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/** 博客 RSS 2.0 —— 旧 Hexo 站的订阅地址，迁过来保持不变。 */
export async function rssResponse(): Promise<Response> {
  const posts = await db
    .select({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      tags: post.tags,
      publishedAt: post.publishedAt,
      createdAt: post.createdAt,
    })
    .from(post)
    .where(eq(post.status, "published"))
    .orderBy(desc(post.publishedAt), desc(post.createdAt))
    .limit(FEED_SIZE)
    .catch(() => []);

  const self = absUrl("/rss.xml");
  const home = absUrl("/");
  const items = posts
    .map((p) => {
      const link = absUrl(`/blog/${p.slug}`);
      return [
        "    <item>",
        `      <title>${esc(p.title)}</title>`,
        `      <link>${esc(link)}</link>`,
        `      <guid isPermaLink="true">${esc(link)}</guid>`,
        `      <pubDate>${(p.publishedAt ?? p.createdAt).toUTCString()}</pubDate>`,
        p.excerpt ? `      <description>${esc(p.excerpt)}</description>` : "",
        ...(p.tags ?? []).map((t) => `      <category>${esc(t)}</category>`),
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  const lastBuild = posts[0] ? (posts[0].publishedAt ?? posts[0].createdAt) : new Date();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(siteConfig.title)}</title>
    <link>${esc(home)}</link>
    <description>${esc(siteConfig.description)}</description>
    <language>${siteConfig.locale}</language>
    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>
    <atom:link href="${esc(self)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      ...CACHE.feed,
    },
  });
}

// ---------------- sitemap.xml ----------------

interface SitemapEntry {
  url: string;
  lastModified?: Date;
  changeFrequency: "daily" | "weekly" | "monthly";
  priority: number;
}

export async function sitemapResponse(): Promise<Response> {
  const [posts, albums] = await Promise.all([
    db
      .select({ slug: post.slug, updatedAt: post.updatedAt })
      .from(post)
      .where(eq(post.status, "published"))
      .orderBy(desc(post.publishedAt))
      .catch(() => []),
    db
      .select({ name: album.name, updatedAt: album.updatedAt })
      .from(album)
      .catch(() => []),
  ]);
  const entries: SitemapEntry[] = [
    { url: absUrl("/"), changeFrequency: "daily", priority: 1 },
    ...DOMAINS.map((d) => ({
      url: absUrl(d.path),
      changeFrequency: "weekly" as const,
      priority: d.key === "blog" ? 0.8 : 0.6,
    })),
    ...posts.map((p) => ({
      url: absUrl(`/blog/${p.slug}`),
      lastModified: p.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...albums.map((a) => ({
      url: absUrl(`/gallery/${encodeURIComponent(a.name)}`),
      lastModified: a.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
  const body = entries
    .map((e) =>
      [
        "<url>",
        `<loc>${esc(e.url)}</loc>`,
        e.lastModified ? `<lastmod>${e.lastModified.toISOString()}</lastmod>` : "",
        `<changefreq>${e.changeFrequency}</changefreq>`,
        `<priority>${e.priority}</priority>`,
        "</url>",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      ...CACHE.feed,
    },
  });
}

// ---------------- robots.txt ----------------

export function robotsResponse(): Response {
  const txt = [
    "User-Agent: *",
    "Allow: /",
    "Disallow: /dash",
    "Disallow: /api/",
    "",
    `Sitemap: ${absUrl("/sitemap.xml")}`,
    "",
  ].join("\n");
  return new Response(txt, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
