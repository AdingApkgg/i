"use client";

import { cn } from "@i/ui";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ADMIN_FIELDS, ADMIN_ORDER } from "@/lib/admin-fields";
import { authClient } from "@/lib/auth-client";

export function DashShell({
  userName,
  children,
}: {
  userName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/dash/login");
    router.refresh();
  }

  const item = (href: string, label: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      className={cn(
        "block rounded-[var(--radius-md)] px-3 py-2 text-sm transition",
        active
          ? "bg-primary text-primary-foreground font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
      <aside className="w-44 shrink-0">
        <Link href="/" className="mb-4 block px-3 text-lg font-bold">
          i · 后台
        </Link>
        <nav className="space-y-1">
          {item("/dash", "仪表盘", pathname === "/dash")}
          {ADMIN_ORDER.map((k) =>
            item(`/dash/${k}`, ADMIN_FIELDS[k]?.label ?? k, pathname === `/dash/${k}`),
          )}
        </nav>
        <div className="mt-6 border-t border-border px-3 pt-4">
          <div className="truncate text-xs text-muted-foreground">{userName}</div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-1.5 text-sm text-muted-foreground hover:text-destructive"
          >
            退出登录
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
