import { Collection } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { trpcServer } from "@/lib/trpc/server";

export const metadata = { title: "视觉小说" };

export default async function VnPage() {
  const api = await trpcServer();
  const items = await api.vn.list().catch(() => []);
  return (
    <>
      <PageTitle title="视觉小说" subtitle="Galgame 记录" />
      <Collection
        items={items.map((t) => ({
          id: t.id,
          title: t.title,
          subtitle: t.brand || null,
          status: t.status,
          coverUrl: t.coverUrl,
          rating: t.rating,
          link: t.link,
        }))}
      />
    </>
  );
}
