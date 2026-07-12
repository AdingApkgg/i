import { EmptyCard } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { trpcServer } from "@/lib/trpc/server";

export const metadata = { title: "相册" };

export default async function GalleryPage() {
  const api = await trpcServer();
  const items = await api.gallery.list().catch(() => []);
  return (
    <>
      <PageTitle title="相册" subtitle="照片" />
      {items.length === 0 ? (
        <EmptyCard>还没有照片,先去 /dash 添加吧 ✿</EmptyCard>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {items.map((it, i) => (
            <div
              key={`${it.imageUrl}-${i}`}
              className="group relative aspect-square overflow-hidden rounded-[var(--radius-lg)] bg-soft"
            >
              {/* biome-ignore lint/a11y/useAltText: alt via title */}
              <img
                src={it.thumbUrl || it.imageUrl}
                alt={it.title}
                title={it.title}
                loading="lazy"
                className="h-full w-full object-cover transition group-hover:scale-105"
              />
              <div className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/60 to-transparent p-2 text-xs font-medium text-white transition group-hover:translate-y-0">
                <span className="line-clamp-1">{it.title}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
