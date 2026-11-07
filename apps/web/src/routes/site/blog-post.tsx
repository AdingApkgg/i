import { data, Link } from "react-router";
import { ArticleBody } from "@/components/content/article-body";
import { Toc } from "@/components/content/toc";
import { Badge } from "@/components/public/collection";
import { Comments } from "@/components/public/comments";
import { loadArticleBody } from "@/lib/content/load.server";
import { notFoundTo } from "@/lib/degrade.server";
import { formatDate } from "@/lib/format";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/blog-post";

const prose =
  "prose-content mt-6 space-y-4 text-body leading-relaxed [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-soft [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-code [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_img]:rounded-lg [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-soft [&_pre]:p-4 [&_ul]:list-disc [&_ul]:pl-5";

function fmt(d: Date | string) {
  return formatDate(d, { dateStyle: "long" });
}

const LANG_LABEL: Record<string, string> = { zh: "中文", ja: "日本語", en: "English" };

export async function loader({ request, params }: Route.LoaderArgs) {
  const api = serverApi(request);
  const post = await api.blog.bySlug({ slug: params.slug }).catch(notFoundTo(null));
  if (!post) throw data(null, { status: 404 });
  const { contentMd, content, ...rest } = post;
  // 译文页给出原文 + 同篇其它译文；原文页只给译文
  const canonical = post.translationOf ?? post.slug;
  const siblings = (await api.blog.translations({ slug: canonical }).catch(() => []))
    .filter((t) => t.slug !== post.slug)
    .map((t) => ({ slug: t.slug, lang: t.lang, title: t.title }));
  const versions =
    post.lang === "zh"
      ? [{ slug: canonical, lang: "zh", title: post.title }, ...siblings]
      : [
          { slug: canonical, lang: "zh", title: "" },
          ...siblings,
          { slug: post.slug, lang: post.lang, title: post.title },
        ];
  return { post: rest, body: await loadArticleBody({ content, contentMd }), versions };
}

export const meta: Route.MetaFunction = (args) => {
  const post = args.loaderData?.post;
  if (!post) return seo(args, { title: "404", noindex: true });
  return seo(args, {
    title: post.title,
    description: post.excerpt,
    path: `/blog/${post.slug}`,
    image: `/og/blog/${encodeURIComponent(post.slug)}.png`,
    imageAlt: post.title,
    type: "article",
    publishedTime: post.publishedAt ?? post.createdAt,
    modifiedTime: post.updatedAt,
    tags: post.tags,
    alternates: args.loaderData?.versions.map((v) => ({ lang: v.lang, path: `/blog/${v.slug}` })),
    // 草稿可凭 slug 预览，但不让搜索引擎收录
    noindex: post.status !== "published",
  });
};

export default function PostPage({ loaderData }: Route.ComponentProps) {
  const { post, body, versions } = loaderData;
  return (
    <article lang={post.lang} className="relative mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold tracking-wide">{post.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{fmt(post.publishedAt ?? post.createdAt)}</span>
        {(post.tags ?? []).map((t) => (
          <Badge key={t}>{t}</Badge>
        ))}
      </div>
      {versions.length > 1 && (
        <nav aria-label="语言" className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          {versions.map((v) => (
            <Link
              key={v.lang}
              to={`/blog/${v.slug}`}
              prefetch="intent"
              aria-current={v.slug === post.slug ? "page" : undefined}
              className="rounded-full border border-border px-2.5 py-1 hover:border-primary hover:text-primary aria-[current=page]:border-primary aria-[current=page]:text-primary"
            >
              {LANG_LABEL[v.lang] ?? v.lang}
            </Link>
          ))}
        </nav>
      )}
      {body.kind === "rich" && <Toc items={body.toc} />}
      <ArticleBody body={body} className={prose} />
      {/* key：在两篇文章之间直接跳转时重置评论区状态 */}
      <Comments key={post.id} path={`/blog/${post.slug}`} postId={post.id} />
    </article>
  );
}
