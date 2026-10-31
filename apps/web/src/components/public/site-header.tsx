import { NAV_DOMAINS, siteConfig } from "@i/config";
import {
  BookOpen,
  CalendarDays,
  Camera,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Disc3,
  Gamepad2,
  Headphones,
  House,
  Library,
  MessageCircle,
  Monitor,
  Orbit,
  Sword,
  Tv,
  Users,
  X,
} from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import { Dialog } from "radix-ui";
import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { TitleFlourish } from "./title-flourish";
import "./grouped-navigation.css";

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
const sections = [
  {
    key: "daily",
    label: "日常",
    icon: BookOpen,
    keys: ["blog", "gallery", "moments", "masturbation"],
  },
  { key: "collection", label: "收藏", icon: Library, keys: ["music", "anime", "movie", "vn"] },
  { key: "interests", label: "兴趣", icon: Gamepad2, keys: ["maimai", "touhou", "device"] },
].map((section) => ({
  ...section,
  domains: section.keys.map((key) => NAV_DOMAINS.find((domain) => domain.key === key)!),
}));
const friends = NAV_DOMAINS.find((domain) => domain.key === "friends")!;
const isCurrent = (pathname: string, path: string) =>
  pathname === path || (path !== "/" && pathname.startsWith(`${path}/`));

/** 桌面原生折叠分组；手机同一分类打开模态面板，不删除任何栏目。 */
export function SiteHeader() {
  const { pathname } = useLocation();
  const [mobileGroup, setMobileGroup] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelId = useId();
  const selected = sections.find((section) =>
    section.domains.some((domain) => isCurrent(pathname, domain.path)),
  );
  const panelGroup = sections.find((section) => section.key === mobileGroup) ?? sections[0]!;

  // biome-ignore lint/correctness/useExhaustiveDependencies: 路由改变时关闭面板；点击当前页由链接的 onClick 处理。
  useEffect(() => {
    setMobileGroup(null);
  }, [pathname]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (media.matches) setMobileGroup(null);
    };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <LayoutGroup id="site-navigation">
      <motion.header layoutRoot className="sao-menu grouped-navigation">
        <Link to="/" prefetch="intent" className="grouped-brand" aria-label="Asuna 个人空间">
          <Sword size={22} strokeWidth={1.2} aria-hidden="true" />
          {siteConfig.title}
        </Link>
        <motion.nav layoutScroll aria-label="主导航" className="grouped-primary">
          <div className="grouped-desktop">
            <NavLink path="/" label="首页" icon={House} pathname={pathname} kind="desktop" />
            {sections.map((section) => (
              <details
                key={`${section.key}:${pathname}`}
                name="public-sections"
                open={selected?.key === section.key}
                className="grouped-section"
              >
                <summary>
                  <section.icon size={16} strokeWidth={1.4} aria-hidden="true" />
                  <span>{section.label}</span>
                  <ChevronDown size={13} strokeWidth={1.5} aria-hidden="true" />
                </summary>
                <div className="grouped-children">
                  {section.domains.map((domain) => (
                    <NavLink
                      key={domain.key}
                      path={domain.path}
                      label={domain.label}
                      pathname={pathname}
                      kind="desktop"
                      child
                    />
                  ))}
                </div>
              </details>
            ))}
            <NavLink
              path={friends.path}
              label={friends.label}
              icon={Users}
              pathname={pathname}
              kind="desktop"
            />
          </div>
          <div className="grouped-mobile">
            <NavLink path="/" label="首页" icon={House} pathname={pathname} kind="bar" />
            {sections.map((section) => (
              <button
                key={section.key}
                type="button"
                aria-label={section.label}
                aria-haspopup="dialog"
                aria-controls={panelId}
                aria-expanded={mobileGroup === section.key}
                className="grouped-bar-button"
                data-active={selected?.key === section.key || undefined}
                onClick={(event) => {
                  triggerRef.current = event.currentTarget;
                  setMobileGroup(section.key);
                }}
              >
                {selected?.key === section.key && (
                  <motion.span
                    data-nav-highlight
                    aria-hidden="true"
                    layoutId="active-bar"
                    className="grouped-bar-marker"
                  />
                )}
                <section.icon size={19} strokeWidth={1.5} aria-hidden="true" />
                <span>{section.label}</span>
              </button>
            ))}
            <NavLink
              path={friends.path}
              label={friends.label}
              icon={Users}
              pathname={pathname}
              kind="bar"
            />
          </div>
        </motion.nav>
      </motion.header>
      <Dialog.Root
        open={mobileGroup !== null}
        onOpenChange={(open) => {
          if (!open) setMobileGroup(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="grouped-sheet-overlay" />
          <Dialog.Content
            asChild
            id={panelId}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              triggerRef.current?.focus();
            }}
          >
            <motion.div
              className="grouped-sheet"
              initial={{ y: 20, opacity: 0.8 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="grouped-sheet-heading">
                <Dialog.Title>{panelGroup.label}</Dialog.Title>
                <Dialog.Close aria-label="关闭栏目">
                  <X size={19} strokeWidth={1.4} />
                </Dialog.Close>
              </div>
              <Dialog.Description className="sr-only">
                选择栏目后关闭面板并跳转。可按 Escape 关闭并返回底栏。
              </Dialog.Description>
              <fieldset className="grouped-sheet-tabs" aria-label="切换分组">
                {sections.map((section) => (
                  <button
                    key={section.key}
                    type="button"
                    aria-pressed={mobileGroup === section.key}
                    onClick={() => setMobileGroup(section.key)}
                  >
                    {section.label}
                  </button>
                ))}
              </fieldset>
              <nav aria-label="栏目导航" className="grouped-sheet-links">
                {panelGroup.domains.map((domain) => (
                  <NavLink
                    key={domain.key}
                    path={domain.path}
                    label={domain.label}
                    icon={domainIcons[domain.key as keyof typeof domainIcons]}
                    pathname={pathname}
                    kind="panel"
                    onNavigate={() => setMobileGroup(null)}
                  />
                ))}
              </nav>
            </motion.div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <noscript>
        <nav aria-label="全部栏目" className="grouped-fallback">
          <a href="/">首页</a>
          {NAV_DOMAINS.map((domain) => (
            <a key={domain.key} href={domain.path}>
              {domain.label}
            </a>
          ))}
        </nav>
      </noscript>
    </LayoutGroup>
  );
}

function NavLink({
  path,
  label,
  icon: Icon,
  pathname,
  kind,
  child = false,
  onNavigate,
}: {
  path: string;
  label: string;
  icon?: typeof House;
  pathname: string;
  kind: "desktop" | "bar" | "panel";
  child?: boolean;
  onNavigate?: () => void;
}) {
  const active = isCurrent(pathname, path);
  return (
    <Link
      to={path}
      prefetch="intent"
      aria-current={active ? "page" : undefined}
      className={`grouped-link grouped-link--${kind}${child ? " grouped-link--child" : ""}`}
      onClick={onNavigate}
    >
      {active && (
        <motion.span
          data-nav-highlight
          aria-hidden="true"
          layoutId={`active-${kind}`}
          className={kind === "bar" ? "grouped-bar-marker" : "grouped-highlight"}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      )}
      {Icon && <Icon size={kind === "bar" ? 19 : 16} strokeWidth={1.4} aria-hidden="true" />}
      <span>{label}</span>
      {kind === "panel" && <ChevronRight size={14} strokeWidth={1.3} aria-hidden="true" />}
    </Link>
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
