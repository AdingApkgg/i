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
} from "@i/ui";
import { getPost, type Post } from "@i/api-client";
import { use, useEffect, useState } from "react";
import { t } from "../../../lib/i18n";
import { Markdown } from "../../../components/Markdown";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
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

type Status = "loading" | "ready" | "notfound";

export default function BlogPost({
  params,
}: {
  // Next 16: route params are a Promise, unwrapped with React.use().
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [post, setPost] = useState<Post | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let alive = true;
    getPost(slug)
      .then((p) => {
        if (!alive) return;
        setPost(p);
        setStatus("ready");
      })
      .catch(() => {
        if (!alive) return;
        setStatus("notfound");
      });
    return () => {
      alive = false;
    };
  }, [slug]);

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

        <div className="mt-7">
          <a
            href="/blog"
            className="mb-4 inline-flex items-center gap-1 text-[13px] text-accent transition hover:opacity-80"
          >
            ← {t("blog.back")}
          </a>

          {status === "loading" ? (
            <Card className="grid place-items-center px-5 py-16 text-sm text-muted">
              {t("blog.loading")}
            </Card>
          ) : status === "notfound" ? (
            <Card className="grid place-items-center gap-3 px-5 py-16 text-center">
              <span className="text-3xl">(´・ω・`)</span>
              <p className="text-sm text-muted">{t("blog.notFound")}</p>
              <a href="/blog" className="text-[13px] text-accent hover:opacity-80">
                {t("blog.back")}
              </a>
            </Card>
          ) : (
            post && (
              <Card className="p-6 sm:p-8 md:p-10">
                <article>
                  <header className="mb-6 border-b border-line pb-5">
                    <h1 className="text-[26px] font-bold leading-tight tracking-wide text-ink sm:text-[30px]">
                      {post.title}
                    </h1>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                      {post.status !== "published" && (
                        <Badge className="text-muted">{post.status}</Badge>
                      )}
                      <span>{formatDate(post.created_at)}</span>
                      {post.updated_at && post.updated_at !== post.created_at && (
                        <span>· {t("blog.updated")} {formatDate(post.updated_at)}</span>
                      )}
                    </div>
                  </header>
                  <Markdown>{post.content_md}</Markdown>
                </article>
              </Card>
            )
          )}
        </div>

        <Footer>{t("footer.made")}</Footer>
      </Container>
    </main>
  );
}
