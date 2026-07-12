import { Collection } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { trpcServer } from "@/lib/trpc/server";

export const metadata = { title: "音乐" };

export default async function MusicPage() {
  const api = await trpcServer();
  const items = await api.music.list().catch(() => []);
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
