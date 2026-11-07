import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { Card } from "../components/card";
import { cn } from "../lib/cn";

/**
 * 空态。`card` 用于独立区块，`bare` 用于已经处在 Card / 面板里的位置。
 * 文案走 description，需要主操作时传 action，不要只塞一句灰字。
 */
export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  icon?: LucideIcon;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  variant?: "card" | "bare";
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "card",
  compact,
  className,
  children,
  ...props
}: EmptyStateProps) {
  const body = (
    <div
      className={cn(
        "flex flex-col items-center gap-2 text-center text-sm text-muted-foreground",
        compact ? "px-4 py-6" : "px-8 py-10",
      )}
    >
      {Icon && <Icon className="size-8 text-primary/35" strokeWidth={1.4} aria-hidden="true" />}
      {title && <p className="font-medium text-foreground">{title}</p>}
      {description && <p className="wrap-anywhere">{description}</p>}
      {children}
      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );

  if (variant === "bare") {
    return (
      <div className={cn("min-w-0", className)} {...props}>
        {body}
      </div>
    );
  }
  return (
    <Card className={className} {...props}>
      {body}
    </Card>
  );
}
