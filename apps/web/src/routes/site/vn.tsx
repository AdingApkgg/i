import { Card, CardBody } from "@i/ui";
import { PageTitle } from "@/components/public/site-header";
import { degradeTo } from "@/lib/degrade.server";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import { thumb } from "@/lib/thumb";
import type { Route } from "./+types/vn";

export async function loader({ request }: Route.LoaderArgs) {
  const api = serverApi(request);
  const items = await api.vn.list().catch(degradeTo([]));
  return { items };
}

export const meta: Route.MetaFunction = (args) => seo(args, { title: "视觉小说", path: "/vn" });

export default function VnPage({ loaderData }: Route.ComponentProps) {
  const { items } = loaderData;
  return (
    <>
      <PageTitle title="视觉小说" subtitle="Galgame 记录" />
      <div className="grid gap-5 lg:grid-cols-2">
        {items.map((t) => (
          <Card key={t.id} className="overflow-hidden">
            <CardBody className="space-y-4">
              <div className="flex gap-4">
                {t.coverUrl && (
                  <img
                    src={thumb(t.coverUrl, 320)}
                    alt={`${t.title} 封面`}
                    loading="lazy"
                    className="h-40 w-28 shrink-0 rounded-md object-cover"
                  />
                )}
                <div className="min-w-0 space-y-2">
                  <h2 className="break-words text-lg font-semibold">{t.title}</h2>
                  {t.brand && <p className="text-sm text-muted-foreground">{t.brand}</p>}
                  <p className="text-sm">
                    {t.status}
                    {t.rating != null && ` · 我的评分 ${t.rating}/10`}
                  </p>
                  {t.playHours != null && (
                    <p className="text-sm text-muted-foreground">游玩 {t.playHours} 小时</p>
                  )}
                  {t.released && (
                    <p className="text-xs text-muted-foreground">发售：{t.released}</p>
                  )}
                  {t.vndbRating != null && (
                    <p className="text-xs text-muted-foreground">VNDB 评分：{t.vndbRating}/10</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-sm">
                    {t.vndbId && (
                      <a
                        className="text-primary hover:underline"
                        href={`https://vndb.org/${t.vndbId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        VNDB ↗
                      </a>
                    )}
                    {t.link && t.link !== `https://vndb.org/${t.vndbId}` && (
                      <a
                        className="text-primary hover:underline"
                        href={t.link}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        相关链接 ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>
              {t.descriptionZh && (
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                  {t.descriptionZh}
                </p>
              )}
              {t.descriptionOriginal && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground">简介原文</summary>
                  <p className="mt-2 whitespace-pre-wrap break-words leading-relaxed">
                    {t.descriptionOriginal}
                  </p>
                </details>
              )}
              {t.note && (
                <p className="whitespace-pre-wrap break-words border-t border-border pt-3 text-sm text-muted-foreground">
                  {t.note}
                </p>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
      {items.length === 0 && <p className="text-sm text-muted-foreground">还没有视觉小说记录。</p>}
    </>
  );
}
