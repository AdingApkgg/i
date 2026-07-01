"use client";

import { Button, Container, NavBar, NavLogo } from "@i/ui";
import type { ReactNode } from "react";
import { DOMAINS } from "./domains";

/** A nav entry: the blog (special) plus every config-driven domain. */
export interface NavEntry {
  key: string;
  label: string;
}

export const NAV_ENTRIES: NavEntry[] = [
  { key: "blog", label: "文章" },
  ...DOMAINS.map((d) => ({ key: d.key, label: d.label })),
];

/**
 * CMS chrome: brand + right-side actions over a page column, with a left
 * sidebar to switch between the blog and the config-driven domains.
 */
export function Shell({
  active,
  onNavigate,
  actions,
  children,
}: {
  active: string;
  onNavigate: (key: string) => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <Container>
        <NavBar brand={<NavLogo badge="i">i · 后台</NavLogo>} actions={actions} />
        <div className="flex gap-6 pb-16 md:gap-8">
          <aside className="w-28 shrink-0 md:w-40">
            <nav className="sticky top-4 flex flex-col gap-0.5">
              {NAV_ENTRIES.map((e) => {
                const on = e.key === active;
                return (
                  <button
                    key={e.key}
                    type="button"
                    onClick={() => onNavigate(e.key)}
                    className={`rounded-card px-3 py-2 text-left text-sm transition ${
                      on
                        ? "bg-accent/10 font-medium text-accent"
                        : "text-muted hover:bg-soft/50 hover:text-ink"
                    }`}
                  >
                    {e.label}
                  </button>
                );
              })}
            </nav>
          </aside>
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </Container>
    </div>
  );
}

export function LogoutButton({ onLogout }: { onLogout: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onLogout}>
      退出登录
    </Button>
  );
}
