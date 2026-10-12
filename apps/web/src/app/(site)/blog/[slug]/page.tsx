import { siteConfig } from "@i/config";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { HexoContent } from "@/components/hexo/content";
import { Badge } from "@/components/public/collection";
import { Comments } from "@/components/public/comments";
import { RSS_ALTERNATE_TYPES } from "@/lib/site-url";
import { trpcServer } from "@/lib/trpc/server";

type Params = Promise<{ slug: string }>;

// generateMetadata 与页面共用一次查询
const getPost = cache(async (slug: string) => {
  const api = await trpcServer();
  return api.blog.bySlug({ slug }).catch(() => null);
});

function fmt(d: Date | string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "long" }).format(new Date(d));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  const description = post.excerpt ?? undefined;
  return {
    title: post.title,
    description,
    alternates: { canonical: `/blog/${post.slug}`, types: RSS_ALTERNATE_TYPES },
    // 草稿可凭 slug 预览，但不让搜索引擎收录
    robots: post.status === "published" ? undefined : { index: false },
    // openGraph 会整体覆盖父级，siteName/locale 要带上
    openGraph: {
      siteName: siteConfig.title,
      locale: "zh_CN",
      type: "article",
      title: post.title,
      description,
      url: `/blog/${post.slug}`,
      publishedTime: (post.publishedAt ?? post.createdAt).toISOString(),
      modifiedTime: post.updatedAt.toISOString(),
      tags: post.tags,
    },
  };
}

export default async function PostPage({ params }: { params: Params }) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold tracking-wide">{post.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{fmt(post.publishedAt ?? post.createdAt)}</span>
        {post.tags.map((t) => (
          <Badge key={t}>{t}</Badge>
        ))}
      </div>
      <HexoContent
        source={post.contentMd}
        className="mt-6 space-y-4 text-[15px] leading-relaxed [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-soft [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_img]:rounded-[var(--radius-lg)] [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-[var(--radius-md)] [&_pre]:bg-soft [&_pre]:p-4 [&_ul]:list-disc [&_ul]:pl-5"
      />
      <Comments path={`/blog/${slug}`} postId={post.id} />
    </article>
  );
}
