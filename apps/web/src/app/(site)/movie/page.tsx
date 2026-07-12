import { Collection } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { trpcServer } from "@/lib/trpc/server";

export const metadata = { title: "影视" };

export default async function MoviePage() {
  const api = await trpcServer();
  const items = await api.movie.list().catch(() => []);
  return (
    <>
      <PageTitle title="影视" subtitle="在看 · 看过 · 想看" />
      <Collection
        items={items.map((t) => ({
          id: t.id,
          title: t.title,
          subtitle: t.category || (t.year ? String(t.year) : null),
          status: t.status,
          coverUrl: t.coverUrl,
          rating: t.rating,
          link: t.link,
        }))}
      />
    </>
  );
}
