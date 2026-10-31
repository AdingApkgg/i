import { Card, CardBody } from "@i/ui";
import { ArrowRight, ArrowUp, Disc3 } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Stagger, StaggerItem } from "@/components/motion";
import { Badge } from "@/components/public/collection";
import { HomeHero, HomeScene } from "@/components/public/home-scene";
import { adxChartUrl } from "@/lib/adx";
import { degradeTo } from "@/lib/degrade.server";
import { formatDate } from "@/lib/format";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import { thumb, thumbProps } from "@/lib/thumb";
import type { Route } from "./+types/home";

function fmtDate(d: Date | string) {
  return formatDate(d, { month: "long", day: "numeric" });
}

export async function loader({ request }: Route.LoaderArgs) {
  const api = serverApi(request);
  const [posts, music, movie, vn, moments, photos, mmProfile, mmB50] = await Promise.all([
    api.blog.list().catch(degradeTo([])),
    api.music.list().catch(degradeTo([])),
    api.movie.list().catch(degradeTo([])),
    api.vn.list().catch(degradeTo([])),
    api.moments.list().catch(degradeTo([])),
    api.gallery
      .page({ limit: 6 })
      .then((r) => r.items)
      .catch(degradeTo([])),
    api.maimai.profile().catch(degradeTo(null)),
    api.maimai.b50().catch(degradeTo({ b35: [], b15: [] })),
  ]);
  // 只下发页面用到的条数：loader 数据会整个序列化进 HTML
  return {
    posts: posts.slice(0, 3),
    music: music.slice(0, 1),
    movie: movie.slice(0, 1),
    vn: vn.slice(0, 1),
    moments: moments.slice(0, 4),
    photos,
    mmProfile,
    mmB50,
  };
}

export const meta: Route.MetaFunction = (args) => seo(args, { path: "/" });

export default function Home({ loaderData }: Route.ComponentProps) {
  const { posts, music, movie, vn, moments, photos, mmProfile, mmB50 } = loaderData;
  const mmTop = [...mmB50.b35, ...mmB50.b15].sort((a, b) => b.ra - a.ra).slice(0, 6);

  return (
    <HomeScene>
      <HomeHero />

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
                <Link prefetch="intent" to="/gallery" className="block h-full w-full">
                  <img
                    {...thumbProps(
                      p.thumbUrl || p.imageUrl,
                      [320, 640],
                      "(min-width: 768px) 160px, 34vw",
                    )}
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
                <Link prefetch="intent" to={`/blog/${p.slug}`} className="block h-full">
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
    </HomeScene>
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
    <section data-home-section>
      <div className="relative mb-3 flex items-baseline justify-between pb-2">
        <span
          data-section-rule
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-px origin-left bg-primary/25"
        />
        <h2 className="text-lg font-semibold">{title}</h2>
        {moreHref && (
          <Link
            prefetch="intent"
            to={moreHref}
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
          <img
            src={thumb(cover, 320)}
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
