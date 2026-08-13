"use client";

import { NAV_DOMAINS, siteConfig } from "@i/config";
import { cn } from "@i/ui";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Shared public top nav — 活动项带滑动下划线（layoutId 共享布局动画）。 */
export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
        <Link href="/" className="shrink-0 text-lg font-bold tracking-wide">
          {siteConfig.name}
          <span className="text-primary">.</span>
        </Link>
        <nav className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {NAV_DOMAINS.map((d) => {
            const active = pathname === d.path || pathname.startsWith(`${d.path}/`);
            return (
              <Link
                key={d.key}
                href={d.path}
                className={cn(
                  "relative pb-0.5 transition",
                  active ? "font-medium text-primary" : "text-muted-foreground hover:text-primary",
                )}
              >
                {d.label}
                {active && (
                  <motion.span
                    layoutId="site-nav-underline"
                    className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 500, damping: 35 }}
                  />
                )}
              </Link>
            );
          })}
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
