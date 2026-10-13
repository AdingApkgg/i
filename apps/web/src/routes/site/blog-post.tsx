import { data } from "react-router";
import { HexoContent } from "@/components/hexo/content";
import { Badge } from "@/components/public/collection";
import { Comments } from "@/components/public/comments";
import { notFoundTo } from "@/lib/degrade.server";
import { formatDate } from "@/lib/format";
import { compileHexo } from "@/lib/hexo/compile.server";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/blog-post";

const prose =
  "mt-6 space-y-4 text-[15px] leading-relaxed [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-soft [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px] [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_img]:rounded-[var(--radius-lg)] [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-[var(--radius-md)] [&_pre]:bg-soft [&_pre]:p-4 [&_ul]:list-disc [&_ul]:pl-5";

function fmt(d: Date | string) {
  return formatDate(d, { dateStyle: "long" });
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const post = await serverApi(request).blog.bySlug({ slug: params.slug }).catch(notFoundTo(null));
  if (!post) throw data(null, { status: 404 });
  const { contentMd, ...rest } = post;
  const code = await compileHexo(contentMd);
  // 编译好的 MDX 已含全文；只有编译失败（回退纯 markdown 渲染）时才下发原文
  return { post: rest, code, source: code ? "" : contentMd };
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
    // 草稿可凭 slug 预览，但不让搜索引擎收录
    noindex: post.status !== "published",
  });
};

export default function PostPage({ loaderData }: Route.ComponentProps) {
  const { post, code, source } = loaderData;
  return (
    <article className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold tracking-wide">{post.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span>{fmt(post.publishedAt ?? post.createdAt)}</span>
        {(post.tags ?? []).map((t) => (
          <Badge key={t}>{t}</Badge>
        ))}
      </div>
      <HexoContent code={code} source={source} className={prose} />
      {/* key：在两篇文章之间直接跳转时重置评论区状态 */}
      <Comments key={post.id} path={`/blog/${post.slug}`} postId={post.id} />
    </article>
  );
}
