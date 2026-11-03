/**
 * 仪表盘汇总：各内容域条目数 + 近 30 天新增趋势。
 * 只服务后台首页的图表，域清单按 ADMIN_ORDER 手工映射到表（media 走对象存储，没有表）。
 */
import {
  album,
  bangumiEntry,
  device,
  friend,
  maimaiRecord,
  masturbationDay,
  moment,
  monitor,
  movie,
  photo,
  post,
  touhou,
  track,
  vn,
} from "@i/db";
import { count, sql } from "drizzle-orm";
import { adminProcedure } from "../orpc";

/** 内容域 → 表；顺序与后台导航一致 */
const TABLES = {
  blog: post,
  moments: moment,
  gallery: photo,
  albums: album,
  music: track,
  anime: bangumiEntry,
  movie,
  vn,
  touhou,
  device,
  maimai: maimaiRecord,
  masturbation: masturbationDay,
  friends: friend,
  monitor,
} as const;

export const dashStatsRouter = {
  overview: adminProcedure.handler(async ({ context }) => {
    const keys = Object.keys(TABLES) as (keyof typeof TABLES)[];
    const counts = await Promise.all(
      keys.map(async (key) => {
        const [row] = await context.db.select({ n: count() }).from(TABLES[key]);
        return { key, n: Number(row?.n ?? 0) };
      }),
    );

    // 近 30 天新增：文章 / 动态 / 相册图，按天聚合（前端补齐空白天）
    const days = ((
      await context.db.execute<{ day: string; n: number }>(sql`
        select to_char(day, 'MM-DD') as day, count(*)::int as n
        from (
          select date_trunc('day', "createdAt") as day from "Post" where "createdAt" > now() - interval '30 days'
          union all
          select date_trunc('day', "createdAt") from "Moment" where "createdAt" > now() - interval '30 days'
          union all
          select date_trunc('day', "createdAt") from "Photo" where "createdAt" > now() - interval '30 days'
        ) s
        group by 1
        order by min(day)
      `)
    ).rows ?? []) as { day: string; n: number }[];

    const total = counts.reduce((sum, c) => sum + c.n, 0);
    return { counts, days, total };
  }),
};
