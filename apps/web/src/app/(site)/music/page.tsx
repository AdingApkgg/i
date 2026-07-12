import { Collection } from "@/components/public/collection";
import { HexoContent } from "@/components/hexo/content";
import { PageTitle } from "@/components/public/site-header";
import { trpcServer } from "@/lib/trpc/server";

export const metadata = { title: "音乐" };

const prose =
  "space-y-3 text-[15px] leading-relaxed [&_a]:text-primary [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:mt-4 [&_h4]:font-semibold [&_img]:rounded-[var(--radius-md)]";

export default async function MusicPage() {
  const api = await trpcServer();
  const page = await api.page.get({ id: "music" }).catch(() => null);
  if (page) {
    return (
      <>
        <PageTitle title="音乐" subtitle="在听 · 听过 · 想听" />
        <HexoContent source={page.contentMd} className={prose} />
      </>
    );
  }
  // fallback: manual Track entries
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
