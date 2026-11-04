import { ExternalLink } from "lucide-react";
import { FadeIn } from "@/components/motion";
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

/** 统计条上的状态顺序：先亮着在读的，再通关，最后搁置 */
const STATUS_ORDER = ["在玩", "通关", "搁置"] as const;

/** 系列名：「美少女万华镜 -…-」「末世孤雄1」都收敛成系列词，两组以上才当系列 */
function seriesOf(title: string) {
  const base = title.split(/\s*[-–—]\s*/)[0] ?? title;
  return base.replace(/[\s0-9０-９]+$/u, "").trim() || title;
}

/** 平均分保留一位，没有评分就不显示 */
function avgOf(list: Vn[]) {
  const rated = list.map((t) => t.rating).filter((r): r is number => r != null);
  if (rated.length === 0) return null;
  return (rated.reduce((sum, r) => sum + r, 0) / rated.length).toFixed(1);
}

type Vn = Route.ComponentProps["loaderData"]["items"][number];

function toRow(t: Vn): RecordRow {
  const tags = t.tags ?? [];
  const platforms = t.platforms ?? [];
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
    tags:
      tags.length > 0 ? (
        <>
          {tags.slice(0, 6).map((tag) => (
            <RecordChip key={tag}>{tag}</RecordChip>
          ))}
          {tags.length > 6 && (
            <span className="text-[11px] text-muted-foreground">+{tags.length - 6}</span>
          )}
        </>
      ) : undefined,
    facts: (
      <>
        {t.released && <span>发售 {t.released}</span>}
        {t.playHours != null && <span>游玩 {t.playHours} 小时</span>}
        {t.lengthMinutes != null && (
          <span>官方时长约 {Math.round(t.lengthMinutes / 6) / 10} 小时</span>
        )}
        {platforms.map((p) => (
          <span key={p}>{p}</span>
        ))}
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

/** 系列 / 散条共用的章节抬头：编号、名字、条数，评分靠右 */
function SectionHead({
  index,
  title,
  count,
  avg,
}: {
  index: number;
  title: string;
  count: number;
  avg: string | null;
}) {
  return (
    <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <span className="font-mono text-[10px] tracking-[0.22em] text-primary/55 uppercase tabular-nums">
        {String(index).padStart(2, "0")}
      </span>
      <h2 className="text-sm leading-snug font-semibold break-words">{title}</h2>
      <span className="text-xs text-muted-foreground tabular-nums">{count} 部</span>
      {avg && (
        <span className="ml-auto font-serif text-xs text-muted-foreground italic tabular-nums">
          均 {avg}
        </span>
      )}
    </div>
  );
}

export default function VnPage({ loaderData }: Route.ComponentProps) {
  const { items } = loaderData;
  const counts = STATUS_ORDER.map((status) => ({
    status,
    count: items.filter((t) => t.status === status).length,
  })).filter((entry) => entry.count > 0);

  const buckets = new Map<string, Vn[]>();
  for (const item of items) {
    const key = seriesOf(item.title);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }
  const series = [...buckets.entries()].filter(([, list]) => list.length > 1);
  const singles = [...buckets.values()].filter((list) => list.length === 1).flat();

  return (
    <>
      <PageTitle title="视觉小说" subtitle="读过的故事都按顺序留在这里" />
      {items.length === 0 ? (
        <EmptyCard>还没有视觉小说记录。</EmptyCard>
      ) : (
        <>
          <FadeIn>
            <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
              <Badge>共 {items.length} 部</Badge>
              {counts.map(({ status, count }) => (
                <span key={status} className="inline-flex items-center gap-1.5 tabular-nums">
                  <span
                    aria-hidden="true"
                    className={`size-1.5 rounded-full ${
                      status === "在玩"
                        ? "bg-sky-500"
                        : status === "通关"
                          ? "bg-primary"
                          : "bg-amber-500"
                    }`}
                  />
                  {status} {count}
                </span>
              ))}
              {series.length > 0 && (
                <span className="hidden sm:inline">· {series.length} 个系列</span>
              )}
            </div>
          </FadeIn>
          {/* 系列块带章节脊线，散条收进最后一章，避免插在中间打断系列 */}
          {series.map(([name, list], index) => (
            <section key={name} className="mb-7 border-l border-border pl-4 sm:pl-5">
              <SectionHead index={index + 1} title={name} count={list.length} avg={avgOf(list)} />
              <RecordList items={list.map(toRow)} label={name} columns />
            </section>
          ))}
          {singles.length > 0 && (
            <section className="mb-7 border-l border-border pl-4 sm:pl-5">
              <SectionHead
                index={series.length + 1}
                title={series.length > 0 ? "单独记录" : "全部记录"}
                count={singles.length}
                avg={avgOf(singles)}
              />
              <RecordList
                items={singles.map(toRow)}
                label={series.length > 0 ? "单独记录" : "视觉小说记录"}
                columns
              />
            </section>
          )}
          <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
            <ExternalLink className="size-3" aria-hidden="true" />
            VNDB 与相关链接会在新标签页打开
          </p>
        </>
      )}
    </>
  );
}
