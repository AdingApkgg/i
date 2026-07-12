import type * as React from "react";

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
 * 原生 <details> 折叠块。
 * MDX 预处理器会输出 <HideToggle title color>...</HideToggle>。
 */
export function HideToggle({
  title,
  color,
  children,
}: {
  title?: string;
  color?: string;
  children?: React.ReactNode;
}) {
  const accent = (color && COLOR_MAP[color]) || undefined;

  return (
    <details className="group my-4 overflow-hidden rounded-[var(--radius-md)] border border-border bg-card">
      <summary
        className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 font-medium text-foreground select-none"
        style={accent ? { color: accent } : undefined}
      >
        <span
          aria-hidden
          className="inline-block text-muted-foreground transition-transform group-open:rotate-90"
        >
          ▸
        </span>
        <span>{title ?? "展开"}</span>
      </summary>
      <div className="border-t border-border px-4 py-3 text-foreground [&>:first-child]:mt-0 [&>:last-child]:mb-0">
        {children}
      </div>
    </details>
  );
}
