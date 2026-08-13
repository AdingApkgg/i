"use client";

import { cn } from "@i/ui";
import { motion } from "framer-motion";
import {
  Activity,
  Camera,
  Disc3,
  Film,
  Gamepad2,
  Images,
  Laptop,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  MessageCircle,
  Music,
  PenLine,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ADMIN_FIELDS, ADMIN_ORDER } from "@/lib/admin-fields";
import { authClient } from "@/lib/auth-client";

/** 内容域 → 侧栏图标。 */
const DOMAIN_ICONS: Record<string, LucideIcon> = {
  blog: PenLine,
  music: Music,
  maimai: Disc3,
  movie: Film,
  vn: Gamepad2,
  touhou: Sparkles,
  device: Laptop,
  gallery: Camera,
  albums: Images,
  moments: MessageCircle,
  friends: Users,
  monitor: Activity,
};

export function DashShell({ userName, children }: { userName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/dash/login");
    router.refresh();
  }

  const item = (href: string, label: string, active: boolean, Icon: LucideIcon) => (
    <Link
      key={href}
      href={href}
      className={cn(
        "relative block rounded-[var(--radius-md)] px-3 py-2 text-sm transition",
        active
          ? "font-medium text-primary-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId="dash-nav-active"
          className="absolute inset-0 rounded-[var(--radius-md)] bg-primary"
          transition={{ type: "spring", stiffness: 450, damping: 35 }}
        />
      )}
      <span className="relative z-10 flex items-center gap-2">
        <Icon className="size-4" />
        {label}
      </span>
    </Link>
  );

  return (
    <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6">
      <aside className="w-44 shrink-0">
        <Link href="/" className="mb-4 block px-3 text-lg font-bold">
          i · 后台
        </Link>
        <nav className="space-y-1">
          {item("/dash", "仪表盘", pathname === "/dash", LayoutDashboard)}
          {ADMIN_ORDER.map((k) =>
            item(
              `/dash/${k}`,
              ADMIN_FIELDS[k]?.label ?? k,
              pathname === `/dash/${k}`,
              DOMAIN_ICONS[k] ?? PenLine,
            ),
          )}
          {item("/dash/settings", "设置", pathname === "/dash/settings", Settings)}
        </nav>
        <div className="mt-6 border-t border-border px-3 pt-4">
          <div className="truncate text-xs text-muted-foreground">{userName}</div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive"
          >
            <LogOut className="size-3.5" />
            退出登录
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
