import { ExternalLink } from "lucide-react";
import { Badge, EmptyCard } from "@/components/public/collection";
import {
  RecordChip,
  RecordLink,
  RecordList,
  type RecordRow,
} from "@/components/public/record-list";
import { PageTitle } from "@/components/public/site-header";
import { degradeTo } from "@/lib/degrade.server";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/vn";

export async function loader({ request }: Route.LoaderArgs) {
  const api = serverApi(request);
  const items = await api.vn.list().catch(degradeTo([]));
  return { items };
}

export const meta: Route.MetaFunction = (args) => seo(args, { title: "视觉小说", path: "/vn" });

const STATUS_TONE: Record<string, string> = {
  在玩: "sky",
  通关: "primary",
  搁置: "amber",
};

/** 系列名：「美少女万华镜 -…-」「末世孤雄1」都收敛成系列词，两组以上才当系列 */
function seriesOf(title: string) {
  const base = title.split(/\s*[-–—]\s*/)[0] ?? title;
  return base.replace(/[\s0-9０-９]+$/u, "").trim() || title;
}

type Vn = Route.ComponentProps["loaderData"]["items"][number];

function toRow(t: Vn): RecordRow {
  return {
    id: t.id,
    title: t.title,
    coverUrl: t.coverUrl,
    chips: (
      <>
        {t.brand && <span className="text-xs text-muted-foreground">{t.brand}</span>}
        <RecordChip tone={STATUS_TONE[t.status] ?? "muted"}>{t.status}</RecordChip>
      </>
    ),
    rating: t.rating,
    facts: (
      <>
        {t.released && <span>发售 {t.released}</span>}
        {t.playHours != null && <span>游玩 {t.playHours} 小时</span>}
        {t.vndbRating != null && <span>VNDB {t.vndbRating}/10</span>}
        {t.vndbId && <RecordLink href={`https://vndb.org/${t.vndbId}`}>VNDB</RecordLink>}
        {t.link && t.link !== `https://vndb.org/${t.vndbId}` && (
          <RecordLink href={t.link}>相关链接</RecordLink>
        )}
      </>
    ),
    body:
      t.descriptionZh || t.descriptionOriginal ? (
        <details className="group/intro text-sm">
          <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground hover:text-primary">
            <span className="transition-transform group-open/intro:rotate-90" aria-hidden="true">
              ▸
            </span>
            简介
          </summary>
          {t.descriptionZh && (
            <p className="mt-2 leading-relaxed break-words whitespace-pre-wrap">
              {t.descriptionZh}
            </p>
          )}
          {t.descriptionOriginal && (
            <p className="mt-2 leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
              {t.descriptionOriginal}
            </p>
          )}
        </details>
      ) : undefined,
    links: t.note ? (
      <span className="block border-l-2 border-primary/40 pl-3 text-sm leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
        {t.note}
      </span>
    ) : undefined,
  };
}

export default function VnPage({ loaderData }: Route.ComponentProps) {
  const { items } = loaderData;
  const cleared = items.filter((t) => t.status === "通关").length;
  const playing = items.filter((t) => t.status === "在玩").length;

  const buckets = new Map<string, Vn[]>();
  for (const item of items) {
    const key = seriesOf(item.title);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }
  const singles = [...buckets.entries()]
    .filter(([, list]) => list.length === 1)
    .flatMap(([, list]) => list);

  return (
    <>
      <PageTitle title="视觉小说" subtitle="读过的故事都按顺序留在这里" />
      {items.length === 0 ? (
        <EmptyCard>还没有视觉小说记录。</EmptyCard>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
            <Badge>共 {items.length} 部</Badge>
            {cleared > 0 && <span>通关 {cleared}</span>}
            {playing > 0 && <span>在玩 {playing}</span>}
          </div>
          {/* 系列块就地成组，散条合并成一块并留在它首次出现的位置 */}
          {(() => {
            let singlesPlaced = false;
            return [...buckets.entries()].map(([name, list]) => {
              if (list.length > 1) {
                return (
                  <section key={name} className="mb-6">
                    <h2 className="mb-2 flex items-center gap-2 border-b border-border pb-1.5 text-sm font-semibold">
                      <span aria-hidden="true" className="h-3.5 w-0.5 rounded-full bg-primary" />
                      {name}
                      <span className="text-xs font-normal text-muted-foreground">
                        {list.length}
                      </span>
                    </h2>
                    <RecordList items={list.map(toRow)} label={name} />
                  </section>
                );
              }
              if (singlesPlaced) return null;
              singlesPlaced = true;
              return <RecordList key="singles" items={singles.map(toRow)} label="视觉小说记录" />;
            });
          })()}
          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ExternalLink className="size-3" aria-hidden="true" />
            VNDB 与相关链接会在新标签页打开
          </p>
        </>
      )}
    </>
  );
}
