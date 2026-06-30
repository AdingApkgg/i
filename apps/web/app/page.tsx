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

const GALLERY_TILES = [
  "from-violet-300 to-violet-400",
  "from-rose-300 to-rose-400",
  "from-sky-300 to-sky-400",
  "from-amber-300 to-amber-400",
  "from-pink-300 to-pink-400",
  "from-teal-300 to-teal-400",
];

const ANIME_TILES = [
  { titleKey: "anime.i1Title", subKey: "anime.i1Sub", grad: "from-violet-300 to-violet-400" },
  { titleKey: "anime.i2Title", subKey: "anime.i2Sub", grad: "from-rose-300 to-rose-400" },
  { titleKey: "anime.i3Title", subKey: "anime.i3Sub", grad: "from-sky-300 to-sky-400" },
  { titleKey: "anime.i4Title", subKey: "anime.i4Sub", grad: "from-amber-300 to-amber-400" },
];

const FRIENDS = ["wikimoe", "lemonkoi", "imaegoo", "paul.ren", "u.sb"];

/* ---- page ------------------------------------------------------------ */

export default function Home() {
  const [count, setCount] = useState<CountResp | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [vns, setVns] = useState<Vn[] | null>(null);

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
  }, []);

  const online = health ? health.db && health.redis : null;
  const recentPosts = (posts ?? []).slice(0, 3);
  const topTrack = (tracks ?? [])[0];
  const topVn = (vns ?? [])[0];

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
            {/* 在看 — movie module not built yet (placeholder) */}
            <TrackingCard
              status={t("tracking.watching")}
              title={t("anime.i1Title")}
              subtitle={t("anime.i1Sub")}
              gradient="from-sky-300 to-sky-400"
            />
            <TrackingCard
              status={t("tracking.watching")}
              title="—"
              subtitle={t("tracking.movieTodo")}
              gradient="from-amber-300 to-amber-400"
            />
          </div>
        </Section>

        {/* ---- 说说 (TODO backend) ---- */}
        <Section title={t("moments.title")} moreLabel={t("moments.more")} moreHref="/moments">
          <TodoNote>{t("moments.todo")}</TodoNote>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {["moments.i1", "moments.i2", "moments.i3"].map((k) => (
              <Card key={k} className="p-[18px]">
                <p className="text-sm leading-relaxed text-ink">{t(k)}</p>
              </Card>
            ))}
          </div>
        </Section>

        {/* ---- 相册 (TODO backend) ---- */}
        <Section title={t("gallery.title")} moreLabel={t("gallery.more")} moreHref="/gallery">
          <TodoNote>{t("gallery.todo")}</TodoNote>
          <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
            {GALLERY_TILES.map((g, i) => (
              <div
                key={i}
                className={`aspect-square rounded-card-sm bg-gradient-to-br ${g} shadow-soft-sm`}
              />
            ))}
          </div>
        </Section>

        {/* ---- 番剧追踪 (TODO backend) ---- */}
        <Section title={t("anime.title")} moreLabel={t("anime.more")} moreHref="/anime">
          <TodoNote>{t("anime.todo")}</TodoNote>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {ANIME_TILES.map((a) => (
              <TrackingCard
                key={a.titleKey}
                status={t(a.subKey).split(" · ")[1] ?? t("tracking.watching")}
                title={t(a.titleKey)}
                subtitle={t(a.subKey)}
                gradient={a.grad}
              />
            ))}
          </div>
        </Section>

        {/* ---- 友链 (TODO admin-configurable) ---- */}
        <Section title={t("friends.title")} moreLabel={t("friends.more")} moreHref="/friends">
          <TodoNote>{t("friends.todo")}</TodoNote>
          <div className="flex flex-wrap gap-3">
            {FRIENDS.map((name) => (
              <a
                key={name}
                href="#"
                className="flex items-center gap-2 rounded-pill bg-surface py-2 pl-2 pr-3.5 shadow-soft-sm transition hover:-translate-y-0.5 hover:shadow-soft"
              >
                <Avatar size="sm">{name[0]?.toUpperCase()}</Avatar>
                <span className="text-[13px] text-ink">{name}</span>
              </a>
            ))}
          </div>
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

function TodoNote({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 inline-flex items-center gap-1.5 rounded-pill bg-soft px-3 py-1 text-xs font-semibold text-accent-ink">
      <span>✎</span>
      {children}
    </div>
  );
}
