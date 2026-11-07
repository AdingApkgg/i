import { Card } from "@i/ui";
import { Coffee, Heart, Sparkles } from "lucide-react";
import { useState } from "react";
import { data } from "react-router";
import { ArticleBody } from "@/components/content/article-body";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { Badge } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { loadArticleBody } from "@/lib/content/load.server";
import { degradeTo } from "@/lib/degrade.server";
import { formatDate } from "@/lib/format";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/donate";

const prose =
  "prose-content space-y-3 text-body leading-relaxed [&_a]:text-primary [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_img]:rounded-md [&_img]:max-h-72 [&_li]:my-1 [&_ul]:list-disc [&_ul]:pl-5";

/** 计入 ￥ 总额的渠道；B站 充电是 B币，单独显示 */
const CNY_PLATFORMS = new Set(["微信", "支付宝", "QQ"]);

export async function loader({ request }: Route.LoaderArgs) {
  const api = serverApi(request);
  const [page, sponsors] = await Promise.all([
    api.page.get({ id: "donate" }).catch(degradeTo(null)),
    api.donate.list().catch(degradeTo([])),
  ]);
  if (!page) throw data(null, { status: 404 });
  const { contentMd, content } = page;
  return { page, body: await loadArticleBody({ content, contentMd }), sponsors };
}

export const meta: Route.MetaFunction = (args) => {
  const page = args.loaderData?.page;
  if (!page) return seo(args, { title: "404", noindex: true });
  return seo(args, { title: page.title, path: "/donate" });
};

type Sponsor = Route.ComponentProps["loaderData"]["sponsors"][number];

const yuan = (cents: number) =>
  (cents / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 头像多半放在别人的图床上，挂了就退回首字，别留破图 */
function Avatar({ src, name }: { src?: string | null; name: string }) {
  const [bad, setBad] = useState(false);
  if (!src || bad)
    return (
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-soft text-sm font-semibold text-primary/50">
        {name.slice(0, 1)}
      </div>
    );
  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBad(true)}
      className="size-9 shrink-0 rounded-full object-cover"
    />
  );
}

export default function DonatePage({ loaderData }: Route.ComponentProps) {
  const { page, body, sponsors } = loaderData;
  const total = sponsors
    .filter((s) => CNY_PLATFORMS.has(s.platform))
    .reduce((sum, s) => sum + s.amountCents, 0);
  const coins = sponsors
    .filter((s) => s.platform === "B站")
    .reduce((sum, s) => sum + s.amountCents, 0);
  const people = new Set(sponsors.map((s) => s.name)).size;

  return (
    <>
      <PageTitle title={page.title} subtitle="请我喝杯咖啡" />
      <ArticleBody body={body} className={prose} />

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-2">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Heart className="size-4 text-primary" />
            赞助墙
          </h2>
          <span className="text-xs text-muted-foreground">
            {sponsors.length} 笔 · {people} 位{total > 0 && ` · 累计 ￥${yuan(total)}`}
            {coins > 0 && ` · ${yuan(coins)} B币`}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            按时间倒序
          </span>
        </div>

        {sponsors.length === 0 ? (
          <Card className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Coffee className="size-4" />
            还没有人赞助，等第一位 ✿
          </Card>
        ) : (
          <Stagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sponsors.map((s: Sponsor) => (
              <StaggerItem key={s.id} hover>
                <Card className="flex h-full items-start gap-3 p-3">
                  <Avatar src={s.avatarUrl} name={s.name} />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">{s.name}</span>
                      <Badge>{s.platform}</Badge>
                      {(s.amountText || s.amountCents > 0) && (
                        <span className="text-xs text-primary">
                          {s.amountText ??
                            (s.platform === "B站"
                              ? `${yuan(s.amountCents)} B币`
                              : `￥${yuan(s.amountCents)}`)}
                        </span>
                      )}
                    </div>
                    {s.message && (
                      <p className="text-xs leading-relaxed break-words text-muted-foreground">
                        {s.message}
                      </p>
                    )}
                    {s.sponsoredAt && (
                      <p className="text-caption text-muted-foreground">
                        {formatDate(s.sponsoredAt)}
                      </p>
                    )}
                  </div>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        )}
      </section>

      <FadeIn className="mt-8 text-xs text-muted-foreground">
        赞助不作为任何承诺的依据，博客永远免费、没有广告 ✿
      </FadeIn>
    </>
  );
}
