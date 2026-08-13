import Link from "next/link";
import { FadeIn } from "@/components/motion";
import { EmptyCard } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { trpcServer } from "@/lib/trpc/server";

export const metadata = { title: "相册" };

const PREVIEW = 8;

interface SectionData {
  key: string;
  name: string;
  description?: string | null;
  cover?: string | null;
  count: number;
  photos: { id: string; imageUrl: string; thumbUrl: string | null; title: string }[];
}

function AlbumSection({ section, index }: { section: SectionData; index: number }) {
  const href = `/gallery/${encodeURIComponent(section.name)}`;
  const overflow = section.count - section.photos.length;
  // 自定义封面放预览条首位；与第一张照片相同（迁移默认值）时不重复展示
  const firstSrc = section.photos[0] && (section.photos[0].thumbUrl || section.photos[0].imageUrl);
  const cover = section.cover && section.cover !== firstSrc ? section.cover : null;
  return (
    <FadeIn delay={index * 0.05}>
      <section className="mt-8 first:mt-0">
        <div className="flex items-baseline justify-between gap-3">
          <Link href={href} className="group flex items-baseline gap-2">
            <h2 className="text-lg font-bold transition group-hover:text-primary">
              {section.name}
            </h2>
            <span className="text-xs text-muted-foreground">{section.count} 张</span>
          </Link>
          <Link
            href={href}
            className="shrink-0 text-xs text-muted-foreground transition hover:text-primary"
          >
            查看全部 →
          </Link>
        </div>
        {section.description && (
          <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
        )}
        {section.photos.length === 0 && (
          <p className="mt-3 text-sm text-muted-foreground">这个图集还是空的 ✿</p>
        )}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {cover && (
            <Link
              href={href}
              className="group relative shrink-0 overflow-hidden rounded-[var(--radius-lg)] bg-soft"
            >
              {/* biome-ignore lint/performance/noImgElement: MinIO 图源，沿用原生 img */}
              <img
                src={cover}
                alt={`${section.name} 封面`}
                loading="lazy"
                className="h-28 w-auto min-w-20 object-cover transition group-hover:scale-105 sm:h-36"
              />
            </Link>
          )}
          {section.photos.map((p, i) => {
            const isLast = i === section.photos.length - 1;
            return (
              <Link
                key={p.id}
                href={href}
                className="group relative shrink-0 overflow-hidden rounded-[var(--radius-lg)] bg-soft"
              >
                {/* biome-ignore lint/performance/noImgElement: MinIO 图源，沿用原生 img */}
                <img
                  src={p.thumbUrl || p.imageUrl}
                  alt={p.title || section.name}
                  loading="lazy"
                  className="h-28 w-auto min-w-20 object-cover transition group-hover:scale-105 sm:h-36"
                />
                {isLast && overflow > 0 && (
                  <span className="absolute inset-0 grid place-items-center bg-black/50 text-sm font-medium text-white">
                    +{overflow}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </section>
    </FadeIn>
  );
}

export default async function GalleryPage() {
  const api = await trpcServer();
  const data = await api.gallery.albums({ preview: PREVIEW }).catch(() => null);

  const sections: SectionData[] = [];
  if (data) {
    for (const a of data.albums)
      sections.push({
        key: a.id,
        name: a.name,
        description: a.description,
        cover: a.coverUrl,
        count: a._count.photos,
        photos: a.photos,
      });
    if (data.unassigned.count > 0)
      sections.push({
        key: "__unassigned__",
        name: "未分类",
        description: null,
        count: data.unassigned.count,
        photos: data.unassigned.photos,
      });
  }

  return (
    <>
      <PageTitle title="相册" subtitle="按图集整理的照片" />
      {!data ? (
        <EmptyCard>相册加载失败了，稍后刷新再试试 ᐕ)⁾⁾</EmptyCard>
      ) : sections.length === 0 ? (
        <EmptyCard>还没有图集,先去 /dash 添加吧 ✿</EmptyCard>
      ) : (
        sections.map((s, i) => <AlbumSection key={s.key} section={s} index={i} />)
      )}
    </>
  );
}
