import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap font-medium [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        neutral: "bg-soft text-muted-foreground",
        primary: "bg-primary/12 text-primary",
        info: "bg-info/12 text-info-strong dark:text-info-contrast",
        success: "bg-success/12 text-success-strong dark:text-success",
        warning: "bg-warning/15 text-warning-strong dark:text-warning-bright",
        danger: "bg-destructive/12 text-destructive",
      },
      size: {
        sm: "rounded-pill px-2 py-0.5 text-caption",
        md: "rounded-pill px-2.5 py-1 text-xs",
      },
      outline: { true: "ring-1 ring-inset", false: "" },
    },
    compoundVariants: [
      { tone: "neutral", outline: true, className: "ring-border" },
      { tone: "primary", outline: true, className: "ring-primary/25" },
      { tone: "info", outline: true, className: "ring-info/25" },
      { tone: "success", outline: true, className: "ring-success/25" },
      { tone: "warning", outline: true, className: "ring-warning/30" },
      { tone: "danger", outline: true, className: "ring-destructive/25" },
    ],
    defaultVariants: { tone: "neutral", size: "sm", outline: false },
  },
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  icon?: LucideIcon;
  dot?: boolean;
}

/** 状态/计数标签。语义色只用 tone，不在调用处写调色板类名。 */
export function StatusBadge({
  tone,
  size,
  outline,
  icon: Icon,
  dot,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, size, outline }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />}
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </span>
  );
}

export { badgeVariants };
