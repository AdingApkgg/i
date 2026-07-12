import { Collection } from "@/components/public/collection";
import { HexoContent } from "@/components/hexo/content";
import { PageTitle } from "@/components/public/site-header";
import { trpcServer } from "@/lib/trpc/server";

export const metadata = { title: "影视" };

const prose =
  "space-y-3 text-[15px] leading-relaxed [&_a]:text-primary [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_img]:rounded-[var(--radius-md)]";

export default async function MoviePage() {
  const api = await trpcServer();
  const page = await api.page.get({ id: "movie" }).catch(() => null);
  if (page) {
    return (
      <>
        <PageTitle title="影视" subtitle="站长珍藏的亿些电影" />
        <HexoContent source={page.contentMd} className={prose} />
      </>
    );
  }
  const items = await api.movie.list().catch(() => []);
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
