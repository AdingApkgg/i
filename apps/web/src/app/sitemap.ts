import { DOMAINS } from "@i/config";
import { db } from "@i/db";
import type { MetadataRoute } from "next";
import { absUrl } from "@/lib/site-url";

// 内容在库里，构建期连不上 DB —— 每次请求现查
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, albums] = await Promise.all([
    db.post
      .findMany({
        where: { status: "published" },
        select: { slug: true, updatedAt: true },
        orderBy: { publishedAt: "desc" },
      })
      .catch(() => []),
    db.album.findMany({ select: { name: true, updatedAt: true } }).catch(() => []),
  ]);

  return [
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
}
