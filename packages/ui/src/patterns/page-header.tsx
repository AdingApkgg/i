import type * as React from "react";
import { cn } from "../lib/cn";

/** 页面主标题区。标题之外只放一句说明和右侧操作，装饰走 children。 */
export interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  size?: "md" | "lg";
}

export function PageHeader({
  title,
  description,
  actions,
  size = "lg",
  className,
  children,
  ...props
}: PageHeaderProps) {
  return (
    <header className={cn("mb-6", className)} {...props}>
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1
            className={cn(
              "font-bold tracking-wide wrap-anywhere",
              size === "lg" ? "text-2xl" : "text-xl sm:text-2xl",
            )}
          >
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground wrap-anywhere">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/** 区块小标题：标题 + 可选说明/计数 + 右侧操作。列表、表单分组、面板内部使用。 */
export interface SectionHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
  ...props
}: SectionHeaderProps) {
  return (
    <div
      className={cn("flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1", className)}
      {...props}
    >
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
        <h2 className="font-semibold wrap-anywhere">{title}</h2>
        {description && (
          <span className="text-xs text-muted-foreground wrap-anywhere">{description}</span>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
