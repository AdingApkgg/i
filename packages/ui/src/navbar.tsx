import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactNode,
} from "react";
import { cn } from "./cn";

/* ----------------------------------------------------------------------- */

export interface NavBarProps extends HTMLAttributes<HTMLElement> {
  /** Brand cluster — typically <NavLogo>. */
  brand?: ReactNode;
  /** Center nav links — typically <NavLink> elements. */
  links?: ReactNode;
  /** Right-side actions — typically <IconButton> elements. */
  actions?: ReactNode;
}

/** Top navigation row: brand · links · round action buttons. */
export function NavBar({
  className = "",
  brand,
  links,
  actions,
  children,
  ...props
}: NavBarProps) {
  return (
    <nav
      className={cn("flex flex-wrap items-center gap-4 py-5", className)}
      {...props}
    >
      {brand}
      {links != null && (
        <div className="ml-2 flex flex-wrap gap-1">{links}</div>
      )}
      {actions != null && <div className="ml-auto flex gap-2">{actions}</div>}
      {children}
    </nav>
  );
}

/* ----------------------------------------------------------------------- */

export interface NavLogoProps extends HTMLAttributes<HTMLDivElement> {
  /** Badge glyph (e.g. "i"). */
  badge?: ReactNode;
  /** Wordmark text / nodes. */
  children?: ReactNode;
}

/** Brand: gradient rounded badge + bold wordmark. */
export function NavLogo({
  className = "",
  badge,
  children,
  ...props
}: NavLogoProps) {
  return (
    <div
      className={cn("flex items-center gap-2.5 text-lg font-bold", className)}
      {...props}
    >
      <span
        className="grid h-[38px] w-[38px] place-items-center rounded-[12px] text-xl text-white shadow-soft-md"
        style={{ backgroundImage: "var(--i-grad-accent)" }}
      >
        {badge}
      </span>
      <span>{children}</span>
    </div>
  );
}

/* ----------------------------------------------------------------------- */

export interface NavLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Active/current link styling. */
  active?: boolean;
}

/** Pill nav link — muted by default, white pill + accent on hover/active. */
export function NavLink({
  className = "",
  active = false,
  ...props
}: NavLinkProps) {
  return (
    <a
      className={cn(
        "rounded-pill px-3 py-1.5 text-sm transition",
        active
          ? "bg-surface text-accent shadow-soft-sm"
          : "text-muted hover:bg-surface hover:text-accent hover:shadow-soft-sm",
        className,
      )}
      {...props}
    />
  );
}

/* ----------------------------------------------------------------------- */

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Render as an <a> when an href is supplied. */
  href?: string;
  label?: string;
}

/** Round white icon button (theme toggle, heart, …). */
export function IconButton({
  className = "",
  href,
  label,
  type,
  children,
  ...props
}: IconButtonProps) {
  const cls = cn(
    "grid h-9 w-9 place-items-center rounded-full bg-surface text-accent shadow-soft-sm transition hover:-translate-y-0.5 hover:shadow-soft",
    className,
  );
  if (href != null) {
    return (
      <a href={href} aria-label={label} className={cls}>
        {children}
      </a>
    );
  }
  return (
    <button
      type={type ?? "button"}
      aria-label={label}
      className={cls}
      {...props}
    >
      {children}
    </button>
  );
}
