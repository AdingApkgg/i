"use client";

import { Button, Container, NavBar, NavLogo } from "@i/ui";
import type { ReactNode } from "react";

/** CMS chrome: brand + right-side actions (e.g. logout) over a page column. */
export function Shell({
  actions,
  children,
}: {
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <Container>
        <NavBar
          brand={<NavLogo badge="i">i · 后台</NavLogo>}
          actions={actions}
        />
        <main className="pb-16">{children}</main>
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
