import { siteConfig } from "@i/config";
import { db, post } from "@i/db";
import { eq } from "drizzle-orm";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

export const dynamic = "force-dynamic";
export const alt = `${siteConfig.title} · 博客`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const fmt = (d: Date) => new Intl.DateTimeFormat("zh-CN", { dateStyle: "long" }).format(d);

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
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
    fmt(row.publishedAt ?? row.createdAt),
    ...(row.tags ?? []).slice(0, 3).map((t) => `#${t}`),
  ].join("  ·  ");
  return renderOgImage({ eyebrow: "博客", title: row.title, meta });
}
