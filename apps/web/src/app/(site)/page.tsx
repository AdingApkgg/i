import { NAV_DOMAINS, siteConfig } from "@i/config";
import { Card, CardBody } from "@i/ui";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/public/collection";
import { Mascot } from "@/components/public/mascot";
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
    api.gallery.list().catch(() => []),
    api.maimai.profile().catch(() => null),
    api.maimai.b50().catch(() => ({ b35: [], b15: [] })),
  ]);
  const mmTop = [...mmB50.b35, ...mmB50.b15].sort((a, b) => b.ra - a.ra).slice(0, 6);

  return (
    <div className="space-y-8">
      {/* hero + mascot */}
      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <Card className="relative overflow-hidden">
          <CardBody className="p-8">
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-soft px-3 py-1 text-sm font-medium text-primary">
              <span className="size-1.5 rounded-full bg-primary" /> 在线
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
        <Card className="overflow-hidden">
          <Mascot />
        </Card>
      </div>

      {/* 最近在…… */}
      <Section title="最近在……" moreHref="/music" moreLabel="音乐库">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TrackTile label="在听" title={music[0]?.title} subtitle={music[0]?.artist} cover={music[0]?.coverUrl} href={music[0]?.link} />
          <TrackTile label="在看" title={movie[0]?.title} subtitle={movie[0]?.category} cover={movie[0]?.coverUrl} href={movie[0]?.link} />
          <TrackTile label="在玩" title={vn[0]?.title} subtitle={vn[0]?.brand} cover={vn[0]?.coverUrl} href={vn[0]?.link} />
        </div>
      </Section>

      {/* 舞萌 DX */}
      {mmProfile && mmTop.length > 0 && (
        <Section title={`舞萌 DX · Rating ${mmProfile.rating}`} moreHref="/maimai" moreLabel="全部成绩">
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {mmTop.map((r) => (
              <Link key={r.id} href="/maimai" className="group">
                <Card className="overflow-hidden">
                  <div className="relative aspect-square bg-soft">
                    {r.coverUrl && (
                      // biome-ignore lint/a11y/useAltText: cover
                      <img src={r.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    )}
                    <span className="absolute bottom-1 left-1 rounded-pill bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      ↑{r.ra}
                    </span>
                  </div>
                  <div className="p-1.5 text-center text-[11px] font-semibold text-primary">
                    {r.achievements.toFixed(2)}%
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* 说说 */}
      <Section title="说说" moreHref="/moments">
        {moments.length === 0 ? (
          <Empty>还没有说说 ✿</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {moments.slice(0, 4).map((m) => (
              <Card key={m.id}>
                <CardBody className="py-4">
                  <p className="line-clamp-3 text-sm leading-relaxed">{m.content}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    {m.mood && <Badge>{m.mood}</Badge>}
                    <span>{fmtDate(m.createdAt)}</span>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {/* 相册 */}
      <Section title="相册" moreHref="/gallery">
        {photos.length === 0 ? (
          <Empty>相册还空着 ✿</Empty>
        ) : (
          <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
            {photos.slice(0, 6).map((p) => (
              <Link key={p.id} href="/gallery" className="aspect-square overflow-hidden rounded-[var(--radius-md)] bg-soft">
                {/* biome-ignore lint/a11y/useAltText: alt via title */}
                <img src={p.thumbUrl ?? p.imageUrl} alt={p.title} loading="lazy" className="h-full w-full object-cover transition hover:scale-105" />
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* 最近文章 */}
      <Section title="最近文章" moreHref="/blog">
        {posts.length === 0 ? (
          <Empty>还没有文章 ✿</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {posts.slice(0, 3).map((p) => (
              <Link key={p.id} href={`/blog/${p.slug}`}>
                <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
                  <CardBody>
                    <div className="font-semibold">{p.title}</div>
                    {p.excerpt && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{p.excerpt}</p>}
                    <div className="mt-2 text-xs text-muted-foreground">{fmtDate(p.publishedAt ?? p.createdAt)}</div>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
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
          <Link href={moreHref} className="text-sm text-primary hover:underline">
            {moreLabel} →
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
    <Card className="h-full overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-center gap-3 p-3">
        {cover ? (
          // biome-ignore lint/a11y/useAltText: decorative cover
          <img src={cover} alt="" className="size-14 shrink-0 rounded-[var(--radius-md)] object-cover" />
        ) : (
          <div className="grid size-14 shrink-0 place-items-center rounded-[var(--radius-md)] bg-soft text-primary/50">
            ✿
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
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {body}
    </a>
  ) : (
    body
  );
}
