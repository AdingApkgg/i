import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export interface FooterProps extends HTMLAttributes<HTMLElement> {
  /** Optional stat chips row (e.g. visit counters) rendered in a white pill. */
  counters?: ReactNode;
}

/** Page footer — centered muted text with an optional counter pill. */
export function Footer({
  className = "",
  counters,
  children,
  ...props
}: FooterProps) {
  return (
    <footer
      className={cn(
        "mt-9 text-center text-[13px] leading-loose text-muted",
        className,
      )}
      {...props}
    >
      {counters != null && (
        <div className="mb-2.5 inline-flex gap-3.5 rounded-pill bg-surface px-[18px] py-2 shadow-soft-sm">
          {counters}
        </div>
      )}
      {children}
    </footer>
  );
}
