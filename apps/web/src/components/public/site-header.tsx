import { NAV_DOMAINS, siteConfig } from "@i/config";
import { cn } from "@i/ui";
import {
  BookOpen,
  CalendarDays,
  Camera,
  Clapperboard,
  Disc3,
  Gamepad2,
  Headphones,
  House,
  MessageCircle,
  Monitor,
  Orbit,
  Sword,
  Tv,
  Users,
} from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router";
import { TitleFlourish } from "./title-flourish";

const domainIcons = {
  blog: BookOpen,
  music: Headphones,
  maimai: Disc3,
  anime: Tv,
  movie: Clapperboard,
  vn: Gamepad2,
  touhou: Orbit,
  masturbation: CalendarDays,
  device: Monitor,
  gallery: Camera,
  moments: MessageCircle,
  friends: Users,
};

/** SAO 系统菜单：宽屏左侧栏 / 窄屏可横滑底栏，保留全部栏目。 */
export function SiteHeader() {
  const { pathname } = useLocation();
  const navRef = useRef<HTMLElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname 改变后 aria-current 的 DOM 才更新，需要重新定位当前栏目。
  useEffect(() => {
    // 直达深层页面或浏览器前进/后退时，当前栏目也应在可见滚动区内。
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
    });
  }, [pathname]);

  return (
    <LayoutGroup id="site-navigation">
      <motion.header
        layoutRoot
        className="sao-menu fixed inset-x-0 bottom-0 z-50 h-[var(--site-nav-height)] border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:inset-x-auto lg:inset-y-0 lg:left-0 lg:h-dvh lg:w-56 lg:border-t-0 lg:border-r lg:pb-0"
      >
        <div className="flex h-full min-h-0 items-center gap-2 px-2 lg:flex-col lg:items-stretch lg:gap-6 lg:px-4 lg:py-6">
          <Link
            prefetch="intent"
            to="/"
            aria-label="首页"
            aria-current={pathname === "/" ? "page" : undefined}
            className="sao-menu-brand flex min-h-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-3 text-xs font-medium text-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 lg:items-start lg:px-3 lg:text-lg lg:font-bold lg:tracking-wide"
          >
            <House aria-hidden className="size-5 lg:hidden" />
            <span className="lg:hidden">首页</span>
            <span className="hidden items-center gap-3 lg:flex">
              <Sword aria-hidden="true" className="sao-menu-symbol size-8" strokeWidth={1} />
              <span>
                {siteConfig.title}
                <span className="sao-menu-caption">日常与冒险的交汇处</span>
              </span>
            </span>
          </Link>
          <motion.nav
            layoutScroll
            ref={navRef}
            aria-label="主导航"
            className="flex min-h-0 min-w-0 flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain py-1 text-sm lg:flex-col lg:items-stretch lg:overflow-x-hidden lg:overflow-y-auto lg:overscroll-y-contain"
          >
            {NAV_DOMAINS.map((d) => {
              const active = pathname === d.path || pathname.startsWith(`${d.path}/`);
              const Icon = domainIcons[d.key as keyof typeof domainIcons] ?? BookOpen;
              return (
                <Link
                  prefetch="intent"
                  key={d.key}
                  to={d.path}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "sao-menu-domain relative isolate flex min-h-11 shrink-0 items-center rounded-lg px-3 whitespace-nowrap transition-colors focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none",
                    active
                      ? "font-medium text-primary"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                >
                  {active && (
                    <motion.span
                      data-nav-highlight
                      aria-hidden="true"
                      layoutId="active-domain"
                      className="sao-menu-active pointer-events-none absolute inset-0 rounded-lg bg-accent"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <Icon aria-hidden="true" strokeWidth={1.5} />
                  <span className="relative">{d.label}</span>
                </Link>
              );
            })}
          </motion.nav>
          <div className="sao-menu-bottom">
            以温柔，守护日常。
            <br />
            <span className="text-primary">Asuna</span> 的个人空间
          </div>
        </div>
      </motion.header>
    </LayoutGroup>
  );
}

/** Page title block used at the top of every content page. */
export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold tracking-wide">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      <TitleFlourish />
    </div>
  );
}
