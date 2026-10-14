import { ArticleBody } from "@/components/content/article-body";
import { Collection } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { loadArticleBody } from "@/lib/content/load.server";
import { degradeTo } from "@/lib/degrade.server";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/music";

const prose =
  "prose-content space-y-3 text-[15px] leading-relaxed [&_a]:text-primary [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:mt-4 [&_h4]:font-semibold [&_img]:rounded-[var(--radius-md)]";

export async function loader({ request }: Route.LoaderArgs) {
  const api = serverApi(request);
  // 优先展示从旧博客导入的整页（meting / dplayer 等），没有再退回手动维护的条目
  const page = await api.page.get({ id: "music" }).catch(degradeTo(null));
  if (page) {
    return { page: await loadArticleBody(page), items: [] };
  }
  return { page: null, items: await api.music.list().catch(degradeTo([])) };
}

export const meta: Route.MetaFunction = (args) => seo(args, { title: "音乐", path: "/music" });

export default function Page({ loaderData }: Route.ComponentProps) {
  const { page, items } = loaderData;
  if (page) {
    return (
      <>
        <PageTitle title="音乐" subtitle="在听 · 听过 · 想听" />
        <ArticleBody body={page} className={prose} />
      </>
    );
  }
  return (
    <>
      <PageTitle title="音乐" subtitle="在听 · 听过 · 想听" />
      <Collection
        items={items.map((t) => ({
          id: t.id,
          title: t.title,
          subtitle: [t.artist, t.album].filter(Boolean).join(" · ") || null,
          status: t.status,
          coverUrl: t.coverUrl,
          rating: t.rating,
          link: t.link,
        }))}
      />
    </>
  );
}
