import { NAV_DOMAINS, siteConfig } from "@i/config";
import { PageHeader } from "@i/ui";
import {
  BookOpen,
  ChevronDown,
  Ellipsis,
  FolderGit2,
  Gamepad2,
  House,
  Library,
  Menu,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import { TitleFlourish } from "./title-flourish";
import "./grouped-navigation.css";

const sectionSpecs = [
  {
    key: "daily",
    label: "日常",
    icon: BookOpen,
    keys: ["blog", "gallery", "moments", "masturbation"],
  },
  { key: "collection", label: "收藏", icon: Library, keys: ["music", "anime", "movie", "vn"] },
  {
    key: "interests",
    label: "兴趣",
    icon: Gamepad2,
    keys: ["maimai", "touhou", "device", "video"],
  },
  { key: "works", label: "作品", icon: FolderGit2, keys: ["project"] },
];
const auxiliaryKeys = ["friends", "donate"];
const sections = sectionSpecs.map((section) => ({
  ...section,
  domains: section.keys.flatMap((key) => NAV_DOMAINS.filter((domain) => domain.key === key)),
}));
const assigned = new Set([...sectionSpecs.flatMap((section) => section.keys), ...auxiliaryKeys]);
const unassigned = NAV_DOMAINS.filter((domain) => !assigned.has(domain.key));
if (unassigned.length)
  sections.push({
    key: "other",
    label: "其他",
    icon: Ellipsis,
    keys: unassigned.map((domain) => domain.key),
    domains: unassigned,
  });
const auxiliary = auxiliaryKeys.flatMap((key) =>
  NAV_DOMAINS.filter((domain) => domain.key === key),
);
const isCurrent = (pathname: string, path: string) =>
  pathname === path || (path !== "/" && pathname.startsWith(`${path}/`));

/** 两种版式共用栏目注册表；原生对话框保留焦点与 Escape，原生 details 可无脚本浏览。 */
export function SiteHeader() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDialogElement>(null);
  const id = useId();
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname 只当重跑触发器；实际比对读 window.location.pathname，见下面的注释。
  useEffect(() => {
    // 路径变化或切到桌面时关闭旧面板，播放器／看板娘不随此操作重挂载。
    // 面板记下自己是在哪个路径打开的：新页面刚提交、旧效果还没跑完就再点按钮时，
    // 这次关闭不能把刚打开的面板一起关掉。
    // 用实时地址比对，而不是这次渲染捕获的 pathname：新页面刚提交时旧效果还会补跑一次，
    // 若按旧地址比对就会把随后打开的面板关掉。
    const element = panel.current;
    const here = window.location.pathname;
    if (!element || element.dataset.path === here) return;
    element.dataset.path = here;
    element.close();
  }, [pathname]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 800px)");
    const closeOnDesktop = () => {
      if (media.matches) panel.current?.close();
    };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);
  const close = () => panel.current?.close();
  return (
    <>
      <aside className="public-sidebar">
        <Link className="public-brand" to="/" aria-label={`${siteConfig.title} 个人空间`}>
          {siteConfig.title}
        </Link>
        <p className="public-sidebar-caption">个人空间</p>
        <Navigation pathname={pathname} label="桌面主导航" />
        <a
          className="public-side-contact"
          href={siteConfig.socials.github}
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
      </aside>
      <header className="public-mobile-header">
        <Link className="public-brand" to="/" aria-label={`${siteConfig.title} 个人空间`}>
          {siteConfig.title}
        </Link>
        <button
          className="public-menu-trigger"
          ref={trigger}
          type="button"
          aria-haspopup="dialog"
          aria-controls={id}
          aria-expanded={open}
          onClick={() => {
            const element = panel.current;
            if (!element) return;
            element.dataset.path = window.location.pathname;
            if (!element.open) element.showModal();
            setOpen(true);
          }}
        >
          栏目 <Menu size={17} aria-hidden="true" />
        </button>
      </header>
      <dialog
        className="public-menu-dialog"
        ref={panel}
        id={id}
        aria-labelledby={`${id}-title`}
        onClose={() => {
          setOpen(false);
          trigger.current?.focus({ preventScroll: true });
        }}
      >
        <div className="public-dialog-heading">
          <h2 id={`${id}-title`}>全部栏目</h2>
          <button type="button" aria-label="关闭栏目" onClick={close}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <Navigation pathname={pathname} label="手机全部栏目" onNavigate={close} />
      </dialog>
      <noscript>
        <style>{".public-menu-trigger { display:none; }"}</style>
        <details className="public-nav-fallback" open>
          <summary>全部栏目</summary>
          <Navigation pathname={pathname} label="无脚本全部栏目" />
        </details>
      </noscript>
    </>
  );
}

function Navigation({
  pathname,
  label,
  onNavigate,
}: {
  pathname: string;
  label: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="public-navigation" aria-label={label}>
      <NavItem path="/" label="首页" pathname={pathname} onNavigate={onNavigate} home />
      {sections.map((section) => (
        <details className="public-nav-section" key={`${section.key}:${pathname}`} open>
          <summary>
            <span className="public-nav-icon">
              <section.icon size={17} strokeWidth={1.4} aria-hidden="true" />
            </span>
            <span>{section.label}</span>
            <ChevronDown size={13} aria-hidden="true" />
          </summary>
          <div className="public-nav-children">
            {section.domains.map((domain) => (
              <NavItem
                key={domain.key}
                path={domain.path}
                label={domain.key === "project" ? "作品列表" : domain.label}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        </details>
      ))}
      <div className="public-nav-aux">
        {auxiliary.map((domain) => (
          <NavItem
            key={domain.key}
            path={domain.path}
            label={domain.label}
            pathname={pathname}
            onNavigate={onNavigate}
          />
        ))}
        <NavItem path="/about" label="关于" pathname={pathname} onNavigate={onNavigate} />
      </div>
    </nav>
  );
}

function NavItem({
  path,
  label,
  pathname,
  onNavigate,
  home = false,
}: {
  path: string;
  label: string;
  pathname: string;
  onNavigate?: () => void;
  home?: boolean;
}) {
  return (
    <Link
      className={home ? "public-nav-home" : "public-nav-link"}
      to={path}
      aria-current={isCurrent(pathname, path) ? "page" : undefined}
      onClick={onNavigate}
    >
      {home && (
        <span className="public-nav-icon">
          <House size={17} strokeWidth={1.4} aria-hidden="true" />
        </span>
      )}
      {label}
    </Link>
  );
}

/** Page title block used at the top of every content page. */
export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <PageHeader title={title} description={subtitle}>
      <TitleFlourish />
    </PageHeader>
  );
}
