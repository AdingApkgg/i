import type { AnchorHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export interface SocialButtonProps
  extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Optional leading icon. */
  icon?: ReactNode;
}

/** Soft-pink pill link for social handles (GitHub, 邮箱, RSS, 关于…). */
export function SocialButton({
  className = "",
  icon,
  children,
  ...props
}: SocialButtonProps) {
  return (
    <a
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill bg-soft px-3.5 py-2 text-[13px] font-semibold text-accent-ink transition hover:-translate-y-0.5 hover:shadow-soft-sm",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </a>
  );
}

/** Row wrapper for a set of <SocialButton>s. */
export function SocialRow({
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-wrap gap-2.5", className)} {...props}>
      {children}
    </div>
  );
}
