import type * as React from "react";
import { cn } from "../lib/cn";

/** 列表/筛选工具条：左侧计数与过滤，右侧排序与批量操作。 */
export interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  start?: React.ReactNode;
  end?: React.ReactNode;
  sticky?: boolean;
}

export function Toolbar({ start, end, sticky, className, children, ...props }: ToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-x-3 gap-y-2 text-sm text-muted-foreground",
        sticky && "sticky top-0 z-10 bg-background/90 py-2 backdrop-blur",
        className,
      )}
      {...props}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">{start}</div>
      {end && <div className="flex flex-wrap items-center gap-2">{end}</div>}
      {children}
    </div>
  );
}
