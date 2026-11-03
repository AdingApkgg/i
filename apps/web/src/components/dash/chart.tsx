/**
 * 后台图表的外壳：recharts 的尺寸依赖 DOM，SSR 阶段量不到，
 * 所以挂载前只画等高骨架，避免服务端输出的空 SVG 撑坏布局。
 */

import { cn } from "@i/ui";
import { type ReactNode, useEffect, useState } from "react";

/** 图表共用配色，跟随主题变量（深浅色自动切换） */
export const chartInk = {
  primary: "var(--primary)",
  secondary: "var(--secondary-foreground)",
  accent: "var(--accent-foreground)",
  muted: "var(--muted-foreground)",
  grid: "var(--border)",
  soft: "var(--soft)",
};

export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function ChartFrame({
  className,
  label,
  empty,
  children,
}: {
  /** 高度靠外层类控制，响应式更好写 */
  className?: string;
  /** 给读屏用的说明：图表里是什么数据 */
  label: string;
  empty?: boolean;
  children: ReactNode;
}) {
  const mounted = useMounted();
  return (
    <figure className={cn("h-full min-w-0", className)} aria-label={label}>
      {!mounted || empty ? (
        <div className="grid h-full place-items-center rounded-[var(--radius-md)] bg-soft/60 text-xs text-muted-foreground">
          {mounted && empty ? "暂无数据" : null}
        </div>
      ) : (
        children
      )}
    </figure>
  );
}

/** 提示框统一成站内样式 */
export function ChartTip({
  active,
  payload,
  label,
  unit = "",
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string }[];
  label?: string | number;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-card px-2.5 py-1.5 text-xs shadow-sm">
      {label != null && <div className="mb-0.5 text-muted-foreground">{label}</div>}
      {payload.map((p) => (
        <div key={String(p.name)} className="flex items-center gap-1.5">
          <span
            className={cn("size-2 rounded-full")}
            style={{ background: p.color ?? chartInk.primary }}
          />
          <span>{p.name}</span>
          <span className="font-medium">
            {p.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}
