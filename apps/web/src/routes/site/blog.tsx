import { Card, CardBody } from "@i/ui";
import { Link } from "react-router";
import { Stagger, StaggerItem } from "@/components/motion";
import { Badge, EmptyCard } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { degradeTo } from "@/lib/degrade.server";
import { formatDate } from "@/lib/format";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/blog";

const fmtDate = (d: Date | string) => formatDate(d);

const LANGS = ["zh", "ja", "en"] as const;
const LANG_LABEL = { zh: "中文", ja: "日本語", en: "English" } as const;

export async function loader({ request }: Route.LoaderArgs) {
  const api = serverApi(request);
  const url = new URL(request.url);
  const raw = url.searchParams.get("lang");
  const lang = (LANGS as readonly string[]).includes(raw ?? "")
    ? (raw as (typeof LANGS)[number])
    : "zh";
  const items = await api.blog.list({ lang }).catch(degradeTo([]));
  return { items, lang };
}

export const meta: Route.MetaFunction = (args) =>
  seo(args, {
    title: "博客",
    path: "/blog",
    alternates: LANGS.map((l) => ({ lang: l, path: l === "zh" ? "/blog" : `/blog?lang=${l}` })),
  });

export default function BlogPage({ loaderData }: Route.ComponentProps) {
  const { items, lang } = loaderData;
  return (
    <>
      <PageTitle title="博客" subtitle={lang === "zh" ? "文章" : `文章 · ${LANG_LABEL[lang]}`} />
      <nav aria-label="语言" className="mb-5 flex flex-wrap gap-2 text-xs">
        {LANGS.map((l) => (
          <Link
            key={l}
            to={l === "zh" ? "/blog" : `/blog?lang=${l}`}
            aria-current={l === lang ? "page" : undefined}
            className="rounded-full border border-border px-2.5 py-1 hover:border-primary hover:text-primary aria-[current=page]:border-primary aria-[current=page]:text-primary"
          >
            {LANG_LABEL[l]}
          </Link>
        ))}
      </nav>
      {items.length === 0 ? (
        <EmptyCard>还没有文章,先去 /dash 写一篇吧 ✿</EmptyCard>
      ) : (
        <Stagger className="flex flex-col gap-4">
          {items.map((p) => (
            <StaggerItem key={p.slug} hover>
              <Link prefetch="intent" to={`/blog/${p.slug}`}>
                <Card className="transition hover:shadow-md">
                  <CardBody>
                    <div className="font-semibold">{p.title}</div>
                    {p.excerpt && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.excerpt}</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {(p.tags ?? []).map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {fmtDate(p.publishedAt ?? p.createdAt)}
                      </span>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </>
  );
}
