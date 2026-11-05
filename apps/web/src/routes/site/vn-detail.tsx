import { data } from "react-router";
import { RecordDetail } from "@/components/public/record-detail";
import { RecordChip } from "@/components/public/record-list";
import { degradeTo } from "@/lib/degrade.server";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import { hoursOf, STATUS_TONE, seriesOf } from "@/lib/vn";
import type { Route } from "./+types/vn-detail";

export async function loader({ request, params }: Route.LoaderArgs) {
  const api = serverApi(request);
  // byId 找不到记录返回 null（不是抛错），这里统一转成 404
  const item = await api.vn.byId({ id: params.id });
  if (!item) throw data(null, { status: 404 });
  // 同系列的其他作品：列表页按系列分组，详情页给出这一组的其余入口
  const all = await api.vn.list().catch(degradeTo([]));
  const series = seriesOf(item.title);
  const related = all
    .filter((row) => row.id !== item.id && seriesOf(row.title) === series)
    .sort((a, b) => a.title.localeCompare(b.title, "zh-Hans-CN"))
    .map((row) => ({ title: row.title, to: `/vn/${row.id}`, meta: row.released ?? undefined }));
  return { item, related };
}

export const meta: Route.MetaFunction = (args) => {
  const item = args.loaderData?.item;
  if (!item) return seo(args, { title: "404", noindex: true });
  return seo(args, {
    title: item.title,
    description: item.descriptionZh?.slice(0, 140) ?? item.descriptionOriginal?.slice(0, 140),
    path: `/vn/${item.id}`,
    // 封面是 VNDB 的外部图，比例不是 1200×630，硬塞进 og:image 会给出错误的宽高，先走站点默认卡片
    type: "article",
    modifiedTime: item.updatedAt,
    tags: item.tags,
  });
};

export default function VnDetailPage({ loaderData }: Route.ComponentProps) {
  const { item, related } = loaderData;
  const platforms = item.platforms ?? [];

  return (
    <RecordDetail
      backTo="/vn"
      backLabel="视觉小说"
      title={item.title}
      kicker={item.brand}
      coverUrl={item.coverUrl}
      chips={<RecordChip tone={STATUS_TONE[item.status] ?? "muted"}>{item.status}</RecordChip>}
      rating={item.rating}
      tags={item.tags ?? []}
      facts={[
        item.released ? { label: "发售", value: item.released } : null,
        item.playHours != null ? { label: "游玩", value: `${item.playHours} 小时` } : null,
        item.lengthMinutes != null
          ? { label: "官方时长", value: `约 ${hoursOf(item.lengthMinutes)} 小时` }
          : null,
        platforms.length > 0 ? { label: "平台", value: platforms.join(" / ") } : null,
        item.vndbRating != null ? { label: "VNDB 评分", value: `${item.vndbRating}/10` } : null,
        item.vndbId ? { label: "VNDB", value: item.vndbId } : null,
      ].filter((fact): fact is { label: string; value: string } => fact !== null)}
      sections={[
        item.descriptionZh ? { label: "中文简介", body: item.descriptionZh } : null,
        item.descriptionOriginal ? { label: "原文简介", body: item.descriptionOriginal } : null,
      ].filter((section): section is { label: string; body: string } => section !== null)}
      note={item.note}
      links={[
        item.vndbId ? { label: "VNDB", href: `https://vndb.org/${item.vndbId}` } : null,
        item.bgmId ? { label: "Bangumi", href: `https://bgm.tv/subject/${item.bgmId}` } : null,
        item.link && item.link !== `https://vndb.org/${item.vndbId}`
          ? { label: "相关链接", href: item.link }
          : null,
      ].filter((link): link is { label: string; href: string } => link !== null)}
      related={related}
    />
  );
}
