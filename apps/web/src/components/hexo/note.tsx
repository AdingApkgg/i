import { cn } from "@i/ui";
import type * as React from "react";
import { faIcon } from "./fa-icon";

const COLOR_MAP: Record<string, string> = {
  blue: "#3b82f6",
  cyan: "#06b6d4",
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  red: "#ef4444",
  pink: "var(--primary)",
};

/**
 * Butterfly 风格的提示框 / callout。
 * MDX 预处理器会输出 <Note color icon flavor>...</Note>。
 * flavor 仅为装饰用途，所有 flavor 均渲染为同一种盒子。
 */
export function Note({
  color,
  icon,
  flavor: _flavor,
  children,
}: {
  color?: string;
  icon?: string;
  flavor?: string;
  children?: React.ReactNode;
}) {
  const accent = (color && COLOR_MAP[color]) || "var(--primary)";
  const Icon = faIcon(icon);

  return (
    <div
      className={cn("my-4 flex items-start gap-3 rounded-[var(--radius-md)] px-4 py-3")}
      style={{
        borderLeft: `3px solid ${accent}`,
        background: `color-mix(in srgb, ${accent} 10%, transparent)`,
      }}
    >
      {Icon && (
        <Icon aria-hidden className="mt-[0.2em] size-4 shrink-0" style={{ color: accent }} />
      )}
      <div className="min-w-0 flex-1 text-foreground [&>:first-child]:mt-0 [&>:last-child]:mb-0">
        {children}
      </div>
    </div>
  );
}
