import { HexoContent } from "@/components/hexo/content";
import { Collection } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { degradeTo } from "@/lib/degrade.server";
import { compileHexo } from "@/lib/hexo/compile.server";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/movie";

const prose =
  "space-y-3 text-[15px] leading-relaxed [&_a]:text-primary [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_img]:rounded-[var(--radius-md)]";

export async function loader({ request }: Route.LoaderArgs) {
  const api = serverApi(request);
  // 优先展示从旧博客导入的整页（meting / dplayer 等），没有再退回手动维护的条目
  const page = await api.page.get({ id: "movie" }).catch(degradeTo(null));
  if (page) {
    return { page: { source: page.contentMd, code: await compileHexo(page.contentMd) }, items: [] };
  }
  return { page: null, items: await api.movie.list().catch(degradeTo([])) };
}

export const meta: Route.MetaFunction = (args) => seo(args, { title: "影视", path: "/movie" });

export default function Page({ loaderData }: Route.ComponentProps) {
  const { page, items } = loaderData;
  if (page) {
    return (
      <>
        <PageTitle title="影视" subtitle="站长珍藏的亿些电影" />
        <HexoContent code={page.code} source={page.source} className={prose} />
      </>
    );
  }
  return (
    <>
      <PageTitle title="影视" subtitle="在看 · 看过 · 想看" />
      <Collection
        items={items.map((m) => ({
          id: m.id,
          title: m.title,
          subtitle: m.category,
          status: m.status,
          coverUrl: m.coverUrl,
          rating: m.rating,
          link: m.link,
        }))}
      />
    </>
  );
}
