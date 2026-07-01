"use client";

import {
  Badge,
  Card,
  Container,
  Footer,
  IconButton,
  NavBar,
  NavLink,
  NavLogo,
  Section,
} from "@i/ui";
import { listPosts, type Post } from "@i/api-client";
import { useEffect, useState } from "react";
import { t } from "../../lib/i18n";

/* ---- helpers (mirrors homepage) -------------------------------------- */

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

function excerpt(md: string, max = 120): string {
  const text = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*`_~\[\]()!-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

const NAV_LINKS = [
  { key: "nav.home", href: "/" },
  { key: "nav.blog", href: "/blog", active: true },
  { key: "nav.music", href: "/music" },
  { key: "nav.gal", href: "/gal" },
  { key: "nav.maimai", href: "/maimai" },
  { key: "nav.movie", href: "/movie" },
  { key: "nav.touhou", href: "/touhou" },
  { key: "nav.devices", href: "/devices" },
];

/* ---- page ------------------------------------------------------------ */

export default function BlogIndex() {
  const [posts, setPosts] = useState<Post[] | null>(null);

  useEffect(() => {
    listPosts()
      .then(setPosts)
      .catch(() => setPosts([]));
  }, []);

  const loading = posts === null;
  const list = posts ?? [];

  return (
    <main className="bg-page min-h-screen pb-10 font-sans text-ink">
      <Container>
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

        <Section title={t("blog.title")}>
          {loading ? (
            <Card className="grid place-items-center px-5 py-14 text-sm text-muted">
              {t("blog.loading")}
            </Card>
          ) : list.length === 0 ? (
            <Card className="grid place-items-center px-5 py-14 text-center text-sm text-muted">
              <span className="mb-1 text-2xl">✿</span>
              {t("blog.empty")}
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {list.map((p) => (
                <a key={p.id} href={`/blog/${p.slug}`} className="block">
                  <Card hover className="flex h-full flex-col p-[18px]">
                    <div className="mb-2 text-base font-semibold leading-snug text-ink">
                      {p.title}
                    </div>
                    <p className="mb-3 line-clamp-3 flex-1 text-[13px] leading-relaxed text-muted">
                      {excerpt(p.content_md)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <Badge className={p.status === "published" ? "" : "text-muted"}>
                        {p.status === "published" ? t("blog.tag") : p.status}
                      </Badge>
                      <span>· {formatDate(p.created_at)}</span>
                      <span className="ml-auto text-accent">{t("blog.readMore")}</span>
                    </div>
                  </Card>
                </a>
              ))}
            </div>
          )}
        </Section>

        <Footer>{t("footer.made")}</Footer>
      </Container>
    </main>
  );
}
