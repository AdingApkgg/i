"use client";

/**
 * 实时站点监控列表：react-query 每 30s 轮询 monitor.status（与服务端检查周期一致），
 * 服务端首屏数据作为 fallback，状态变化时圆点/延迟即时更新。
 */
import { Card, CardBody } from "@i/ui";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { motion } from "framer-motion";
import { Activity, Timer } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion";
import { useTRPC } from "@/lib/trpc/client";
import type { AppRouter } from "@/server/root";
import { Badge } from "./collection";

export type MonitorRow = inferRouterOutputs<AppRouter>["monitor"]["status"][number];

function ago(d: Date | string | null) {
  if (!d) return "尚未检查";
  const sec = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  if (sec < 60) return `${sec} 秒前`;
  if (sec < 3600) return `${Math.floor(sec / 60)} 分钟前`;
  return `${Math.floor(sec / 3600)} 小时前`;
}

function Dot({ ok }: { ok: boolean | null }) {
  const color = ok == null ? "bg-gray-400" : ok ? "bg-green-500" : "bg-red-500";
  return (
    <span className="relative flex size-2.5 shrink-0">
      {ok && (
        <span
          className={`absolute inline-flex h-full w-full animate-ping rounded-full ${color} opacity-60`}
        />
      )}
      <span className={`relative inline-flex size-2.5 rounded-full ${color}`} />
    </span>
  );
}

export function MonitorStatus({ initial }: { initial: MonitorRow[] }) {
  const trpc = useTRPC();
  const { data: items = initial } = useQuery({
    ...trpc.monitor.status.queryOptions(),
    refetchInterval: 30_000,
    // 数据经过 RSC 边界，checkedAt 可能已序列化为 string，与路由推断类型不完全一致，此处收敛一次
    initialData: initial as inferRouterOutputs<AppRouter>["monitor"]["status"],
  });

  return (
    <Stagger className="flex flex-col gap-3">
      {items.map((m) => (
        <StaggerItem key={m.id}>
          <Card>
            <CardBody className="flex items-center gap-3">
              <Dot ok={m.ok} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{m.name}</div>
                <div className="truncate text-xs text-muted-foreground">{m.target}</div>
              </div>
              {m.latencyMs != null && (
                <motion.span
                  key={`${m.latencyMs}-${String(m.checkedAt)}`}
                  initial={{ opacity: 0.4 }}
                  animate={{ opacity: 1 }}
                  className="inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground"
                >
                  <Timer className="size-3.5" />
                  {m.latencyMs}ms
                </motion.span>
              )}
              <Badge>{m.kind}</Badge>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {ago(m.checkedAt)}
              </span>
            </CardBody>
          </Card>
        </StaggerItem>
      ))}
      <div className="mt-1 inline-flex items-center gap-1.5 self-end text-xs text-muted-foreground">
        <Activity className="size-3.5" /> 每 30 秒自动刷新
      </div>
    </Stagger>
  );
}
