import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Add a subtle lift-on-hover interaction (good for clickable cards). */
  hover?: boolean;
  /** Render with no inner padding (e.g. media-first cards). */
  flush?: boolean;
}

/** Rounded soft-shadow surface — the workhorse panel of the moe system. */
export function Card({
  className = "",
  hover = false,
  flush = false,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-line bg-surface shadow-soft",
        !flush && "p-5",
        hover &&
          "transition duration-200 will-change-transform hover:-translate-y-1 hover:shadow-lift",
        className,
      )}
      {...props}
    />
  );
}
