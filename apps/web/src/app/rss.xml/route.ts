import { siteConfig } from "@i/config";
import { db } from "@i/db";
import { absUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

const FEED_SIZE = 30;

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/** 博客 RSS 2.0 —— 旧 Hexo 站的订阅地址，迁过来保持不变。 */
export async function GET() {
  const posts = await db.post
    .findMany({
      where: { status: "published" },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: FEED_SIZE,
      select: {
        slug: true,
        title: true,
        excerpt: true,
        tags: true,
        publishedAt: true,
        createdAt: true,
      },
    })
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
        ...p.tags.map((t) => `      <category>${esc(t)}</category>`),
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
      "Cache-Control": "public, max-age=600, s-maxage=3600",
    },
  });
}
