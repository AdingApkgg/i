import { Collection } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { trpcServer } from "@/lib/trpc/server";

export const metadata = { title: "东方" };

export default async function TouhouPage() {
  const api = await trpcServer();
  const items = await api.touhou.list().catch(() => []);
  return (
    <>
      <PageTitle title="东方" subtitle="东方 Project" />
      <Collection
        items={items.map((t) => ({
          id: t.id,
          title: t.title,
          subtitle: t.category,
          status: t.status,
          coverUrl: t.coverUrl,
          rating: t.rating,
          link: t.link,
        }))}
      />
    </>
  );
}
