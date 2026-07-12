import { NAV_DOMAINS, siteConfig } from "@i/config";
import Link from "next/link";

/** Shared public top nav. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/" className="shrink-0 text-lg font-bold tracking-wide">
          {siteConfig.name}
          <span className="text-primary">.</span>
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {NAV_DOMAINS.map((d) => (
            <Link
              key={d.key}
              href={d.path}
              className="text-muted-foreground transition hover:text-primary"
            >
              {d.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

/** Page title block used at the top of every content page. */
export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-wide">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
