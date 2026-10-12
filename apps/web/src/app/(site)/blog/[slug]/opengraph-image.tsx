import { siteConfig } from "@i/config";
import { db } from "@i/db";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

export const dynamic = "force-dynamic";
export const alt = `${siteConfig.title} · 博客`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const fmt = (d: Date) => new Intl.DateTimeFormat("zh-CN", { dateStyle: "long" }).format(d);

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await db.post
    .findUnique({
      where: { slug },
      select: { title: true, tags: true, publishedAt: true, createdAt: true },
    })
    .catch(() => null);
  if (!post) return renderOgImage({ eyebrow: "博客", title: siteConfig.tagline });
  const meta = [
    fmt(post.publishedAt ?? post.createdAt),
    ...post.tags.slice(0, 3).map((t) => `#${t}`),
  ].join("  ·  ");
  return renderOgImage({ eyebrow: "博客", title: post.title, meta });
}
