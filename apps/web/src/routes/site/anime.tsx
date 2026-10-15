import { Card, cn } from "@i/ui";
import { useState } from "react";
import { Badge, EmptyCard } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { COLLECTION_LABELS } from "@/lib/bangumi/types";
import { degradeTo } from "@/lib/degrade.server";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/anime";
export async function loader({ request }: Route.LoaderArgs) {
  return { items: await serverApi(request).bangumi.publicList().catch(degradeTo([])) };
}
// 隐私切换后不能由浏览器或共享 CDN 继续展示旧的公开收藏。
export const headers = () => ({
  "Cache-Control": "private, no-store",
  "CDN-Cache-Control": "no-store",
});

export const meta: Route.MetaFunction = (args) => seo(args, { title: "番剧", path: "/anime" });
export default function AnimePage({ loaderData }: Route.ComponentProps) {
  const [filter, setFilter] = useState(0);
  const items = loaderData.items.filter((e) => !filter || e.type === filter);
  return (
    <>
      <PageTitle title="番剧" subtitle="在看 · 看过 · 想看，把故事慢慢记下来" />
      <section className="mb-6 flex flex-wrap gap-2" aria-label="追番状态筛选">
        {[
          [0, "全部"],
          ...Object.entries(COLLECTION_LABELS).map(([id, label]) => [Number(id), label]),
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            className={cn(
              "rounded-pill px-4 py-1.5 text-sm",
              filter === id
                ? "bg-primary text-primary-foreground"
                : "bg-soft text-muted-foreground",
            )}
            onClick={() => setFilter(Number(id))}
          >
            {label}
          </button>
        ))}
      </section>
      {!items.length ? (
        <EmptyCard>还没有公开的追番记录，故事即将开始 ✿</EmptyCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={item.subjectId} className="overflow-hidden">
              <article aria-label={item.nameCn || item.name}>
                <a
                  href={`https://bgm.tv/subject/${item.subjectId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex gap-3 p-3"
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt=""
                      loading="lazy"
                      className="h-36 w-24 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="h-36 w-24 shrink-0 rounded-md bg-soft" />
                  )}
                  <div className="min-w-0 space-y-2">
                    <h2 className="font-semibold">{item.nameCn || item.name}</h2>
                    {item.nameCn && <p className="text-xs text-muted-foreground">{item.name}</p>}
                    <Badge>{COLLECTION_LABELS[item.type]}</Badge>
                    <p className="text-xs text-muted-foreground">
                      {item.date || "放送日期待定"}
                      {item.eps ? ` · 全 ${item.eps} 话` : ""}
                    </p>
                    <p className="text-xs">已看 {item.watched} 个章节</p>
                    <p className="text-xs">
                      我的评分：{item.rate || "未评"} · Bangumi：{item.score ?? "暂无"}
                    </p>
                  </div>
                </a>
                {item.comment && (
                  <p className="whitespace-pre-wrap break-words border-t border-border px-3 py-3 text-sm text-muted-foreground">
                    {item.comment}
                  </p>
                )}
              </article>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
