"use client";

import {
  Avatar,
  Badge,
  Card,
  Container,
  Footer,
  Hero,
  IconButton,
  NavBar,
  NavLink,
  NavLogo,
  Section,
  SocialButton,
  SocialRow,
} from "@i/ui";
import {
  api,
  getCount,
  getHealth,
  listPosts,
  resolveMedia,
  type CountResp,
  type Health,
  type Post,
  type Track,
  type Vn,
} from "@i/api-client";
import { useEffect, useState, type ReactNode } from "react";
import { t } from "../lib/i18n";
import { MascotSlot } from "../components/sections/MascotSlot";
import { TrackingCard } from "../components/sections/TrackingCard";

/* ---- helpers --------------------------------------------------------- */

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

function excerpt(md: string, max = 56): string {
  const text = md
    .replace(/[#>*`_~\-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Short, human date for 说说 — "刚刚" / "3 小时前" / falls back to M 月 D 日. */
function shortWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  return formatDate(iso);
}

/* ---- domain row types (fields we actually render) -------------------- */

type MovieItem = {
  id: string;
  title: string;
  status: string;
  cover_url?: string | null;
  link?: string | null;
  year?: number | null;
};
type AnimeItem = {
  id: string;
  title: string;
  status: string;
  progress?: string | null;
  cover_url?: string | null;
  link?: string | null;
};
type MomentItem = {
  id: string;
  content: string;
  mood?: string | null;
  created_at: string;
};
type PhotoItem = {
  id: string;
  title: string;
  image_url: string;
  thumb_url?: string | null;
};
type FriendItem = {
  id: string;
  name: string;
  url: string;
  avatar_url?: string | null;
  description?: string | null;
};

const NAV_LINKS: Array<{ key: string; href: string; active?: boolean }> = [
  { key: "nav.home", href: "/", active: true },
  { key: "nav.blog", href: "/blog" },
  { key: "nav.music", href: "/music" },
  { key: "nav.gal", href: "/gal" },
  { key: "nav.maimai", href: "/maimai" },
  { key: "nav.movie", href: "/movie" },
  { key: "nav.touhou", href: "/touhou" },
  { key: "nav.devices", href: "/devices" },
];

const ANIME_GRADIENTS = [
  "from-violet-300 to-violet-400",
  "from-rose-300 to-rose-400",
  "from-sky-300 to-sky-400",
  "from-amber-300 to-amber-400",
];

/* ---- page ------------------------------------------------------------ */

export default function Home() {
  const [count, setCount] = useState<CountResp | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [vns, setVns] = useState<Vn[] | null>(null);
  const [movies, setMovies] = useState<MovieItem[] | null>(null);
  const [animes, setAnimes] = useState<AnimeItem[] | null>(null);
  const [moments, setMoments] = useState<MomentItem[] | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[] | null>(null);
  const [friends, setFriends] = useState<FriendItem[] | null>(null);

  useEffect(() => {
    // Each fetch is isolated — one failing endpoint must not blank the page.
    getCount("/")
      .then(setCount)
      .catch(() => undefined);
    getHealth()
      .then(setHealth)
      .catch(() => undefined);
    listPosts()
      .then(setPosts)
      .catch(() => setPosts([]));
    api
      .GET("/api/music/items")
      .then(({ data }) => setTracks(data ?? []))
      .catch(() => setTracks([]));
    api
      .GET("/api/gal/items")
      .then(({ data }) => setVns(data ?? []))
      .catch(() => setVns([]));
    // The generated OpenAPI schema collapses every /items list to one shared
    // shape, so these domain rows come back structurally untyped — cast at the
    // boundary to the fields we actually render.
    api
      .GET("/api/movie/items")
      .then(({ data }) => setMovies((data as MovieItem[] | undefined) ?? []))
      .catch(() => setMovies([]));
    api
      .GET("/api/anime/items")
      .then(({ data }) => setAnimes((data as AnimeItem[] | undefined) ?? []))
      .catch(() => setAnimes([]));
    api
      .GET("/api/moments/items")
      .then(({ data }) => setMoments((data as MomentItem[] | undefined) ?? []))
      .catch(() => setMoments([]));
    api
      .GET("/api/gallery/items")
      .then(({ data }) => setPhotos((data as PhotoItem[] | undefined) ?? []))
      .catch(() => setPhotos([]));
    api
      .GET("/api/friends/items")
      .then(({ data }) => setFriends((data as FriendItem[] | undefined) ?? []))
      .catch(() => setFriends([]));
  }, []);

  const online = health ? health.db && health.redis : null;
  const recentPosts = (posts ?? []).slice(0, 3);
  const topTrack = (tracks ?? [])[0];
  const topVn = (vns ?? [])[0];
  // Prefer something actually 在看 for the tracking tile; otherwise newest.
  const topMovie =
    (movies ?? []).find((m) => m.status === "在看") ?? (movies ?? [])[0];
  const recentAnime = (animes ?? []).slice(0, 4);
  const recentMoments = (moments ?? []).slice(0, 3);
  const recentPhotos = (photos ?? []).slice(0, 6);
  const recentFriends = (friends ?? []).slice(0, 12);

  return (
    <main className="bg-page min-h-screen pb-10 font-sans text-ink">
      <Container>
        {/* ---- nav ---- */}
        <NavBar
          brand={<NavLogo badge="i">{t("nav.brand")}</NavLogo>}
          links={NAV_LINKS.map((l) => (
            <NavLink key={l.key} href={l.href} active={l.active}>
              {t(l.key)}
            </NavLink>
          ))}
          actions={
            <>
              <IconButton href="#" label={t("nav.theme")}>
                ☾
              </IconButton>
              <IconButton label={t("nav.like")}>♡</IconButton>
            </>
          }
        />

        {/* ---- hero ---- */}
        <Hero className="mb-1.5">
          <Card className="relative overflow-hidden p-8">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full"
              style={{
                background: "radial-gradient(circle, var(--i-bg-2), transparent 70%)",
              }}
            />
            <div className="relative">
              <div className="flex items-center gap-4">
                <Avatar size="lg">✿</Avatar>
                <OnlineBadge online={online} />
              </div>
              <h1 className="mt-4 text-[30px] font-bold tracking-wide">
                {t("hero.name")}
              </h1>
              <div className="text-sm font-semibold text-accent">
                {t("hero.handle")}
              </div>
              <p className="mb-[18px] mt-3.5 text-[15px] text-muted">
                {t("hero.tagline")}
              </p>
              <SocialRow>
                <SocialButton href="https://github.com/AdingApkgg">
                  {t("social.github")}
                </SocialButton>
                <SocialButton href="mailto:xuyuning0430@gmail.com">
                  {t("social.email")}
                </SocialButton>
                <SocialButton href="/rss.xml">{t("social.rss")}</SocialButton>
                <SocialButton href="/about">{t("social.about")}</SocialButton>
              </SocialRow>
            </div>
          </Card>

          <Card flush className="overflow-hidden">
            <MascotSlot />
          </Card>
        </Hero>

        {/* ---- 最近文章 ---- */}
        <Section title={t("posts.title")} moreLabel={t("posts.more")} moreHref="/blog">
          {recentPosts.length === 0 ? (
            <EmptyCard>{t("posts.empty")}</EmptyCard>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {recentPosts.map((p) => (
                <a key={p.id} href={`/blog/${p.slug}`} className="block">
                  <Card hover className="h-full p-[18px]">
                    <div className="mb-2 text-base font-semibold leading-snug text-ink">
                      {p.title}
                    </div>
                    <p className="mb-3 line-clamp-3 text-[13px] leading-relaxed text-muted">
                      {excerpt(p.content_md)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <Badge>{p.status === "published" ? "文章" : p.status}</Badge>
                      <span>· {formatDate(p.created_at)}</span>
                    </div>
                  </Card>
                </a>
              ))}
            </div>
          )}
        </Section>

        {/* ---- 最近在…… ---- */}
        <Section
          title={t("tracking.title")}
          moreLabel={t("tracking.more")}
          moreHref="/tracking"
        >
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <TrackingCard
              status={t("tracking.listening")}
              title={topTrack?.title ?? t("tracking.musicEmpty")}
              subtitle={topTrack?.artist ?? topTrack?.album ?? undefined}
              coverUrl={topTrack?.cover_url}
              gradient="from-rose-300 to-rose-400"
              href={topTrack?.link ?? undefined}
            />
            <TrackingCard
              status={t("tracking.playing")}
              title={topVn?.title ?? t("tracking.galEmpty")}
              subtitle={topVn?.brand ?? undefined}
              coverUrl={topVn?.cover_url}
              gradient="from-violet-300 to-violet-400"
              href={topVn?.link ?? undefined}
            />
            <TrackingCard
              status={t("tracking.watching")}
              title={topMovie?.title ?? t("tracking.movieEmpty")}
              subtitle={
                topMovie?.status ??
                (topMovie?.year != null ? String(topMovie.year) : undefined)
              }
              coverUrl={topMovie?.cover_url}
              gradient="from-sky-300 to-sky-400"
              href={topMovie?.link ?? undefined}
            />
            {/* Top anime doubles as the 4th tracking tile. */}
            <TrackingCard
              status={t("tracking.watching")}
              title={recentAnime[0]?.title ?? t("anime.empty")}
              subtitle={recentAnime[0]?.progress ?? recentAnime[0]?.status}
              coverUrl={recentAnime[0]?.cover_url}
              gradient="from-amber-300 to-amber-400"
              href={recentAnime[0]?.link ?? undefined}
            />
          </div>
        </Section>

        {/* ---- 说说 ---- */}
        <Section title={t("moments.title")} moreLabel={t("moments.more")} moreHref="/moments">
          {recentMoments.length === 0 ? (
            <EmptyCard>{t("moments.empty")}</EmptyCard>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {recentMoments.map((m) => (
                <Card key={m.id} className="p-[18px]">
                  <p className="mb-3 whitespace-pre-line text-sm leading-relaxed text-ink">
                    {m.content}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    {m.mood ? <Badge variant="soft">{m.mood}</Badge> : null}
                    <span>{shortWhen(m.created_at)}</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </Section>

        {/* ---- 相册 ---- */}
        <Section title={t("gallery.title")} moreLabel={t("gallery.more")} moreHref="/gallery">
          {recentPhotos.length === 0 ? (
            <EmptyCard>{t("gallery.empty")}</EmptyCard>
          ) : (
            <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
              {recentPhotos.map((p) => (
                <a
                  key={p.id}
                  href="/gallery"
                  title={p.title}
                  className="group relative aspect-square overflow-hidden rounded-card-sm bg-soft shadow-soft-sm"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveMedia(p.thumb_url ?? p.image_url)}
                    alt={p.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                </a>
              ))}
            </div>
          )}
        </Section>

        {/* ---- 番剧追踪 ---- */}
        <Section title={t("anime.title")} moreLabel={t("anime.more")} moreHref="/anime">
          {recentAnime.length === 0 ? (
            <EmptyCard>{t("anime.empty")}</EmptyCard>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {recentAnime.map((a, i) => (
                <TrackingCard
                  key={a.id}
                  status={a.status}
                  title={a.title}
                  subtitle={a.progress ?? undefined}
                  coverUrl={a.cover_url}
                  gradient={ANIME_GRADIENTS[i % ANIME_GRADIENTS.length]!}
                  href={a.link ?? undefined}
                />
              ))}
            </div>
          )}
        </Section>

        {/* ---- 友链 ---- */}
        <Section title={t("friends.title")} moreLabel={t("friends.more")} moreHref="/friends">
          {recentFriends.length === 0 ? (
            <EmptyCard>{t("friends.empty")}</EmptyCard>
          ) : (
            <div className="flex flex-wrap gap-3">
              {recentFriends.map((f) => (
                <a
                  key={f.id}
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  title={f.description ?? f.name}
                  className="flex items-center gap-2 rounded-pill bg-surface py-2 pl-2 pr-3.5 shadow-soft-sm transition hover:-translate-y-0.5 hover:shadow-soft"
                >
                  <Avatar size="sm" src={f.avatar_url ?? undefined} alt={f.name}>
                    {f.name[0]?.toUpperCase()}
                  </Avatar>
                  <span className="text-[13px] text-ink">{f.name}</span>
                </a>
              ))}
            </div>
          )}
        </Section>

        {/* ---- footer ---- */}
        <Footer
          counters={
            <>
              <span>
                {t("footer.siteViews")}{" "}
                <b className="text-accent">
                  {count ? count.site_pv.toLocaleString() : "…"}
                </b>
              </span>
              <span>
                {t("footer.pageViews")}{" "}
                <b className="text-accent">
                  {count ? count.page_pv.toLocaleString() : "…"}
                </b>
              </span>
            </>
          }
        >
          {t("footer.made")}
        </Footer>
      </Container>
    </main>
  );
}

/* ---- local presentational bits -------------------------------------- */

function OnlineBadge({ online }: { online: boolean | null }) {
  if (online == null) {
    return <Badge variant="soft">● {t("hero.checking")}</Badge>;
  }
  return online ? (
    <Badge variant="soft" className="text-emerald-600">
      ● {t("hero.online")}
    </Badge>
  ) : (
    <Badge variant="soft" className="text-muted">
      ○ {t("hero.offline")}
    </Badge>
  );
}

function EmptyCard({ children }: { children: ReactNode }) {
  return (
    <Card className="grid place-items-center px-5 py-10 text-sm text-muted">
      {children}
    </Card>
  );
}

