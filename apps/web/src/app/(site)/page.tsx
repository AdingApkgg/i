import { NAV_DOMAINS, siteConfig } from "@i/config";
import { Card, CardBody } from "@i/ui";
import { ArrowRight, ArrowUp, Disc3 } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { Badge } from "@/components/public/collection";
import { adxChartUrl } from "@/lib/adx";
import { trpcServer } from "@/lib/trpc/server";

function fmtDate(d: Date | string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric" }).format(new Date(d));
}

export default async function Home() {
  const api = await trpcServer();
  const [posts, music, movie, vn, moments, photos, mmProfile, mmB50] = await Promise.all([
    api.blog.list().catch(() => []),
    api.music.list().catch(() => []),
    api.movie.list().catch(() => []),
    api.vn.list().catch(() => []),
    api.moments.list().catch(() => []),
    api.gallery
      .page({ limit: 6 })
      .then((r) => r.items)
      .catch(() => []),
    api.maimai.profile().catch(() => null),
    api.maimai.b50().catch(() => ({ b35: [], b15: [] })),
  ]);
  const mmTop = [...mmB50.b35, ...mmB50.b15].sort((a, b) => b.ra - a.ra).slice(0, 6);

  return (
    <div className="space-y-8">
      {/* hero（看板娘在全站右下角悬浮，不占 hero） */}
      <FadeIn y={18}>
        <Card className="relative overflow-hidden">
          <CardBody className="p-8">
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-soft px-3 py-1 text-sm font-medium text-primary">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
              </span>{" "}
              在线
            </span>
            <h1 className="mt-4 text-3xl font-bold tracking-wide">{siteConfig.title}</h1>
            <div className="text-sm font-semibold text-primary">{siteConfig.handle}</div>
            <p className="mt-3 text-[15px] text-muted-foreground">{siteConfig.tagline}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {NAV_DOMAINS.map((d) => (
                <Link
                  key={d.key}
                  href={d.path}
                  className="rounded-pill bg-soft px-3.5 py-1.5 text-[13px] font-medium text-accent-foreground transition hover:-translate-y-0.5 hover:brightness-95"
                >
                  {d.label}
                </Link>
              ))}
            </div>
          </CardBody>
        </Card>
      </FadeIn>

      {/* 最近在…… */}
      <Section title="最近在……" moreHref="/music" moreLabel="音乐库">
        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TrackTile
            label="在听"
            title={music[0]?.title}
            subtitle={music[0]?.artist}
            cover={music[0]?.coverUrl}
            href={music[0]?.link}
          />
          <TrackTile
            label="在看"
            title={movie[0]?.title}
            subtitle={movie[0]?.category}
            cover={movie[0]?.coverUrl}
            href={movie[0]?.link}
          />
          <TrackTile
            label="在玩"
            title={vn[0]?.title}
            subtitle={vn[0]?.brand}
            cover={vn[0]?.coverUrl}
            href={vn[0]?.link}
          />
        </Stagger>
      </Section>

      {/* 舞萌 DX */}
      {mmProfile && mmTop.length > 0 && (
        <Section
          title={`舞萌 DX · Rating ${mmProfile.rating}`}
          moreHref="/maimai"
          moreLabel="全部成绩"
        >
          <Stagger className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {mmTop.map((r) => (
              <StaggerItem key={r.id} hover>
                <a
                  href={adxChartUrl(r.songId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Card className="overflow-hidden">
                    <div className="relative aspect-square bg-soft">
                      {r.coverUrl && (
                        // biome-ignore lint/performance/noImgElement: 外链曲绘，沿用原生 img
                        <img
                          src={r.coverUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      )}
                      <span className="absolute bottom-1 left-1 inline-flex items-center rounded-pill bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        <ArrowUp className="size-2.5" />
                        {r.ra}
                      </span>
                    </div>
                    <div className="p-1.5 text-center text-[11px] font-semibold text-primary">
                      {r.achievements.toFixed(2)}%
                    </div>
                  </Card>
                </a>
              </StaggerItem>
            ))}
          </Stagger>
        </Section>
      )}

      {/* 说说 */}
      <Section title="说说" moreHref="/moments">
        {moments.length === 0 ? (
          <Empty>还没有说说 ✿</Empty>
        ) : (
          <Stagger className="grid gap-3 sm:grid-cols-2">
            {moments.slice(0, 4).map((m) => (
              <StaggerItem key={m.id}>
                <Card className="h-full">
                  <CardBody className="py-4">
                    <p className="line-clamp-3 text-sm leading-relaxed">{m.content}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      {m.mood && <Badge>{m.mood}</Badge>}
                      <span>{fmtDate(m.createdAt)}</span>
                    </div>
                  </CardBody>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </Section>

      {/* 相册 */}
      <Section title="相册" moreHref="/gallery">
        {photos.length === 0 ? (
          <Empty>相册还空着 ✿</Empty>
        ) : (
          <Stagger className="grid grid-cols-3 gap-3 md:grid-cols-6">
            {photos.map((p) => (
              <StaggerItem
                key={p.id}
                hover
                className="aspect-square overflow-hidden rounded-[var(--radius-md)] bg-soft"
              >
                <Link href="/gallery" className="block h-full w-full">
                  {/* biome-ignore lint/performance/noImgElement: MinIO 图源，沿用原生 img */}
                  <img
                    src={p.thumbUrl ?? p.imageUrl}
                    alt={p.title || "照片"}
                    loading="lazy"
                    className="h-full w-full object-cover transition hover:scale-105"
                  />
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </Section>

      {/* 最近文章 */}
      <Section title="最近文章" moreHref="/blog">
        {posts.length === 0 ? (
          <Empty>还没有文章 ✿</Empty>
        ) : (
          <Stagger className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {posts.slice(0, 3).map((p) => (
              <StaggerItem key={p.id} hover>
                <Link href={`/blog/${p.slug}`} className="block h-full">
                  <Card className="h-full transition hover:shadow-md">
                    <CardBody>
                      <div className="font-semibold">{p.title}</div>
                      {p.excerpt && (
                        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
                          {p.excerpt}
                        </p>
                      )}
                      <div className="mt-2 text-xs text-muted-foreground">
                        {fmtDate(p.publishedAt ?? p.createdAt)}
                      </div>
                    </CardBody>
                  </Card>
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
  moreHref,
  moreLabel = "全部",
}: {
  title: string;
  children: ReactNode;
  moreHref?: string;
  moreLabel?: string;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">{title}</h2>
        {moreHref && (
          <Link
            href={moreHref}
            className="group inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {moreLabel}
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <Card>
      <CardBody className="py-8 text-center text-sm text-muted-foreground">{children}</CardBody>
    </Card>
  );
}

function TrackTile({
  label,
  title,
  subtitle,
  cover,
  href,
}: {
  label: string;
  title?: string | null;
  subtitle?: string | null;
  cover?: string | null;
  href?: string | null;
}) {
  const body = (
    <Card className="h-full overflow-hidden transition hover:shadow-md">
      <div className="flex items-center gap-3 p-3">
        {cover ? (
          // biome-ignore lint/performance/noImgElement: 外链封面，沿用原生 img
          <img
            src={cover}
            alt=""
            className="size-14 shrink-0 rounded-[var(--radius-md)] object-cover"
          />
        ) : (
          <div className="grid size-14 shrink-0 place-items-center rounded-[var(--radius-md)] bg-soft text-primary/50">
            <Disc3 className="size-6" />
          </div>
        )}
        <div className="min-w-0">
          <Badge>{label}</Badge>
          <div className="mt-1 truncate text-sm font-semibold">{title ?? "还没有记录"}</div>
          {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
    </Card>
  );
  return (
    <StaggerItem hover className="h-full">
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="block h-full">
          {body}
        </a>
      ) : (
        body
      )}
    </StaggerItem>
  );
}
