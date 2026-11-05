import { data } from "react-router";
import { RecordDetail } from "@/components/public/record-detail";
import { RecordChip } from "@/components/public/record-list";
import { degradeTo } from "@/lib/degrade.server";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import { categoryLabel, showDate } from "@/lib/touhou";
import type { Route } from "./+types/touhou-detail";

const STATUS_TONE: Record<string, string> = {
  收藏: "primary",
  通关: "sky",
  在玩: "sky",
  搁置: "amber",
};

export async function loader({ request, params }: Route.LoaderArgs) {
  const api = serverApi(request);
  // byId 找不到记录返回 null（不是抛错），这里统一转成 404
  const item = await api.touhou.byId({ id: params.id });
  if (!item) throw data(null, { status: 404 });
  // 同分类里的最新几部，作为「顺着看下去」的下一跳
  const all = await api.touhou.list().catch(degradeTo([]));
  const related = all
    .filter((row) => row.id !== item.id && row.category === item.category)
    .slice(0, 6)
    .map((row) => ({
      title: row.originalTitle ?? row.title,
      to: `/touhou/${row.id}`,
      meta: showDate(row.releasedAt) ?? undefined,
    }));
  return { item, related };
}

export const meta: Route.MetaFunction = (args) => {
  const item = args.loaderData?.item;
  if (!item) return seo(args, { title: "404", noindex: true });
  return seo(args, {
    title: item.title,
    description: item.note?.slice(0, 140) ?? undefined,
    path: `/touhou/${item.id}`,
    type: "article",
    modifiedTime: item.updatedAt,
  });
};

export default function TouhouDetailPage({ loaderData }: Route.ComponentProps) {
  const { item, related } = loaderData;
  const category = categoryLabel(item.category);

  return (
    <RecordDetail
      backTo="/touhou"
      backLabel="东方"
      title={item.title}
      kicker={
        item.code
          ? `${item.code}${item.originalTitle ? ` · ${item.originalTitle}` : ""}`
          : item.originalTitle
      }
      coverUrl={item.coverUrl}
      coverFit="natural"
      chips={
        <>
          <RecordChip tone={STATUS_TONE[item.status] ?? "muted"}>{item.status}</RecordChip>
          {category && item.category !== "game" && <RecordChip>{category}</RecordChip>}
        </>
      }
      rating={item.rating}
      facts={[
        showDate(item.releasedAt) ? { label: "首发", value: showDate(item.releasedAt)! } : null,
        category ? { label: "分类", value: category } : null,
        item.code ? { label: "编号", value: item.code } : null,
        item.originalTitle ? { label: "原名", value: item.originalTitle } : null,
      ].filter((fact): fact is { label: string; value: string } => fact !== null)}
      note={item.note}
      links={item.link ? [{ label: "相关链接", href: item.link }] : []}
      related={related}
    />
  );
}
