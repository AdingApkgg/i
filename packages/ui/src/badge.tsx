import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export type BadgeVariant = "soft" | "accent" | "overlay";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const VARIANTS: Record<BadgeVariant, string> = {
  /** soft-pink fill, pink ink — tags like “Rust”, “maimai” */
  soft: "bg-soft text-accent-ink",
  /** solid accent fill */
  accent: "bg-accent text-on-accent",
  /** translucent dark chip for sitting on top of colorful covers */
  overlay: "bg-black/30 text-white backdrop-blur-sm",
};

/** Pill-shaped tag / status chip. */
export function Badge({
  className = "",
  variant = "soft",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill px-2.5 py-0.5 text-xs font-semibold leading-5",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
