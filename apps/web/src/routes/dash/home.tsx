import { Card, CardBody } from "@i/ui";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartFrame, ChartTip, chartInk } from "@/components/dash/chart";
import { Stagger, StaggerItem } from "@/components/motion";
import { ADMIN_FIELDS, ADMIN_ORDER } from "@/lib/admin-fields";
import { client } from "@/lib/orpc/client";

const nf = new Intl.NumberFormat("zh-CN");

/** 把后端给的天补齐成连续 30 天，缺的记 0，折线才不会断 */
function fillDays(days: { day: string; n: number }[]) {
  const byDay = new Map(days.map((d) => [d.day, d.n]));
  const out: { day: string; n: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ day: key, n: byDay.get(key) ?? 0 });
  }
  return out;
}

export default function DashHome() {
  const { data } = useQuery({
    queryKey: ["dash-overview"],
    queryFn: () => client.dashStats.overview(),
  });

  const counts = (data?.counts ?? [])
    .map((c) => ({ ...c, label: ADMIN_FIELDS[c.key]?.label ?? c.key }))
    .filter((c) => c.n > 0)
    .sort((a, b) => b.n - a.n);
  const days = fillDays(data?.days ?? []);
  const recent = days.reduce((sum, d) => sum + d.n, 0);

  return (
    <div>
      <h1 className="text-xl font-bold sm:text-2xl">仪表盘</h1>
      <p className="mt-1 text-sm text-muted-foreground">内容概览与选择要管理的域 ✿</p>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardBody>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-semibold">各域内容量</h2>
              <span className="text-xs text-muted-foreground">
                共 {nf.format(data?.total ?? 0)} 条
              </span>
            </div>
            <ChartFrame
              className={counts.length > 6 ? "h-56 sm:h-80" : "h-44 sm:h-56"}
              label="各内容域的条目数条形图"
              empty={!counts.length}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={counts}
                  layout="vertical"
                  margin={{ top: 4, right: 28, bottom: 0, left: 0 }}
                >
                  <CartesianGrid horizontal={false} stroke={chartInk.grid} />
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={64}
                    tick={{ fontSize: 11, fill: chartInk.muted }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTip unit=" 条" />} cursor={{ fill: chartInk.soft }} />
                  <Bar dataKey="n" name="条目" radius={[0, 4, 4, 0]} fill={chartInk.primary}>
                    <LabelList
                      dataKey="n"
                      position="right"
                      className="fill-muted-foreground text-[11px]"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartFrame>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="font-semibold">近 30 天新增</h2>
              <span className="text-xs text-muted-foreground">文章 / 动态 / 相册图</span>
            </div>
            <ChartFrame className="h-44 sm:h-56" label="近 30 天新增内容折线图">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={days} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="dash-new" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartInk.primary} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={chartInk.primary} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke={chartInk.grid} />
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10, fill: chartInk.muted }}
                    axisLine={false}
                    tickLine={false}
                    interval={6}
                  />
                  <YAxis
                    allowDecimals={false}
                    width={24}
                    tick={{ fontSize: 10, fill: chartInk.muted }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<ChartTip unit=" 条" />} cursor={{ stroke: chartInk.muted }} />
                  <Area
                    type="monotone"
                    dataKey="n"
                    name="新增"
                    stroke={chartInk.primary}
                    strokeWidth={2}
                    fill="url(#dash-new)"
                    dot={false}
                    activeDot={{ r: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartFrame>
            <p className="text-xs text-muted-foreground">30 天合计 {nf.format(recent)} 条</p>
          </CardBody>
        </Card>
      </div>

      <h2 className="mt-6 font-semibold">内容域</h2>
      <Stagger className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {ADMIN_ORDER.map((k) => {
          const n = data?.counts.find((c) => c.key === k)?.n ?? 0;
          return (
            <StaggerItem key={k} hover>
              <Link prefetch="intent" to={`/dash/${k}`} className="block h-full">
                <Card className="h-full transition hover:shadow-md">
                  <CardBody className="py-4 text-center">
                    <div className="font-semibold">{ADMIN_FIELDS[k]?.label ?? k}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {k === "media" ? "对象存储" : `${nf.format(n)} 条`}
                    </div>
                  </CardBody>
                </Card>
              </Link>
            </StaggerItem>
          );
        })}
      </Stagger>
    </div>
  );
}
