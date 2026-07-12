import { Collection } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { trpcServer } from "@/lib/trpc/server";

export const metadata = { title: "舞萌" };

export default async function MaimaiPage() {
  const api = await trpcServer();
  const items = await api.maimai.list().catch(() => []);
  return (
    <>
      <PageTitle title="舞萌" subtitle="maimaiDX 成绩" />
      <Collection
        items={items.map((t) => ({
          id: t.id,
          title: t.songTitle,
          subtitle:
            [
              [t.difficulty, t.level].filter(Boolean).join(" "),
              t.achievement != null ? `${t.achievement}%` : null,
            ]
              .filter(Boolean)
              .join(" · ") || null,
          status: t.rank,
          coverUrl: t.coverUrl,
          rating: null,
        }))}
      />
    </>
  );
}
