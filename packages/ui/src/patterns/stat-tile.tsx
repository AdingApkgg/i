import type { LucideIcon } from "lucide-react";
import type * as React from "react";
import { Card, CardBody } from "../components/card";
import { cn } from "../lib/cn";

/** 单个统计格。数值用 tabular-nums，说明只放单位或对比，不放长句。 */
export interface StatTileProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  align?: "start" | "center";
}

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  align = "start",
  className,
  ...props
}: StatTileProps) {
  return (
    <Card className={cn("h-full", className)} {...props}>
      <CardBody className={cn("py-4", align === "center" && "text-center")}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{label}</span>
          {Icon && <Icon className="size-4 text-primary/40" aria-hidden="true" />}
        </div>
        <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </CardBody>
    </Card>
  );
}
