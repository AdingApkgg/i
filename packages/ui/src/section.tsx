import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

// Omit the native `title` attribute so our ReactNode heading prop can reuse the name.
export interface SectionProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  /** Section heading text. */
  title: ReactNode;
  /** Optional “more” link rendered on the right of the heading row. */
  moreLabel?: ReactNode;
  /** Href for the “more” link (renders only when moreLabel is set). */
  moreHref?: string;
  /** Click handler alternative to moreHref. */
  onMore?: () => void;
}

/** Titled content block: accent dot + heading + optional “more →” link. */
export function Section({
  className = "",
  title,
  moreLabel,
  moreHref,
  onMore,
  children,
  ...props
}: SectionProps) {
  return (
    <section className={cn("mt-7", className)} {...props}>
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-accent" />
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        {moreLabel != null &&
          (moreHref != null ? (
            <a
              href={moreHref}
              className="ml-auto text-[13px] text-accent transition hover:opacity-80"
            >
              {moreLabel}
            </a>
          ) : (
            <button
              type="button"
              onClick={onMore}
              className="ml-auto text-[13px] text-accent transition hover:opacity-80"
            >
              {moreLabel}
            </button>
          ))}
      </div>
      {children}
    </section>
  );
}
