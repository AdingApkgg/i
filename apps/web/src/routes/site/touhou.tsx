import { Card } from "@i/ui";
import { ExternalLink, Star } from "lucide-react";
import { Link } from "react-router";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { Badge, EmptyCard } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { degradeTo } from "@/lib/degrade.server";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import { thumbProps } from "@/lib/thumb";
import { categoryLabel, showDate } from "@/lib/touhou";
import type { Route } from "./+types/touhou";

export async function loader({ request }: Route.LoaderArgs) {
  const api = serverApi(request);
  const items = await api.touhou.list().catch(degradeTo([]));
  return { items };
}

export const meta: Route.MetaFunction = (args) => seo(args, { title: "东方", path: "/touhou" });

export default function TouhouPage({ loaderData }: Route.ComponentProps) {
  const { items } = loaderData;
  const games = items.filter((t) => t.category === "game");
  const dates = games
    .map((t) => t.releasedAt)
    .filter((d): d is string => !!d)
    .sort();
  const first = dates[0]?.slice(0, 4);
  const latest = dates.at(-1)?.slice(0, 4);

  return (
    <>
      <PageTitle title="东方" subtitle="东方 Project 全作 · 按首发时间倒序，最新的在最前" />
      {items.length === 0 ? (
        <EmptyCard>还没有东方记录，先去 /dash 添一条吧 ✿</EmptyCard>
      ) : (
        <>
          <FadeIn>
            <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
              <Badge>共 {items.length} 条</Badge>
              {games.length > 0 && <span>正作 {games.length}</span>}
              {first && latest && (
                <span className="tabular-nums">
                  {first} – {latest}
                </span>
              )}
              <span className="hidden sm:inline">· 幻想乡的事，按发售先后往里记</span>
            </div>
          </FadeIn>
          {/* 图按官方原文件的原始宽高比铺满卡片宽度，不裁任何像素、也不加垫边 */}
          <Stagger className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => {
              const card = (
                <Card className="group h-full overflow-hidden transition hover:border-primary/40 hover:shadow-md">
                  <div className="relative">
                    {item.coverUrl ? (
                      <img
                        {...thumbProps(
                          item.coverUrl,
                          [320, 640, 960],
                          "(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw",
                        )}
                        alt={`${item.title} 封面`}
                        loading="lazy"
                        className="block h-auto w-full bg-soft transition duration-500 group-hover:scale-102"
                      />
                    ) : (
                      <div className="flex aspect-3/4 w-full items-center justify-center bg-soft text-xs tracking-kicker text-primary/35 uppercase">
                        Touhou
                      </div>
                    )}
                    {item.code && (
                      <span className="absolute top-2 left-2 rounded-pill bg-background/85 px-2 py-0.5 font-mono text-micro tracking-wider text-primary backdrop-blur">
                        {item.code}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5 p-3">
                    <h2 className="text-sm leading-snug font-semibold break-words">{item.title}</h2>
                    {item.originalTitle && (
                      <p className="line-clamp-1 text-caption text-muted-foreground/80">
                        {item.originalTitle}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                      {item.status && <Badge>{item.status}</Badge>}
                      {item.category && item.category !== "game" && (
                        <Badge>{categoryLabel(item.category)}</Badge>
                      )}
                      {showDate(item.releasedAt) && (
                        <span className="font-mono text-caption tabular-nums text-muted-foreground">
                          {showDate(item.releasedAt)}
                        </span>
                      )}
                      {item.rating != null && (
                        <span className="ml-auto inline-flex items-center gap-0.5 font-serif text-xs italic text-primary">
                          <Star className="size-3 fill-current" aria-hidden="true" />
                          {item.rating}
                        </span>
                      )}
                    </div>
                    {item.note && (
                      <p className="line-clamp-3 text-xs leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
                        {item.note}
                      </p>
                    )}
                  </div>
                </Card>
              );
              return (
                <StaggerItem key={item.id} hover>
                  <div className="flex h-full flex-col gap-1.5">
                    <Link
                      to={`/touhou/${item.id}`}
                      prefetch="intent"
                      aria-label={`${item.title} 详情`}
                      className="block rounded-xl outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary"
                    >
                      {card}
                    </Link>
                    {item.link && (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-caption text-muted-foreground transition-colors hover:text-primary"
                      >
                        <ExternalLink className="size-3" aria-hidden="true" />
                        相关链接
                      </a>
                    )}
                  </div>
                </StaggerItem>
              );
            })}
          </Stagger>
        </>
      )}
    </>
  );
}
