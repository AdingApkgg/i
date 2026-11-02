import { siteConfig } from "@i/config";
import type { ReactNode } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { NavProgress } from "@/components/nav-progress";
import { Providers } from "@/components/providers";
import { seo } from "@/lib/seo";
import { siteUrl } from "@/lib/site-url";
import type { Route } from "./+types/root";
import "@videojs/react/video/skin.css";
import "./globals.css";

export const links: Route.LinksFunction = () => [
  { rel: "alternate", type: "application/rss+xml", href: "/rss.xml", title: siteConfig.title },
];

/** 站点 origin 下发给各路由的 meta（OG 需要绝对地址，见 lib/seo.ts） */
export function loader() {
  return { siteUrl: siteUrl() };
}

/** 兜底 meta：只有更深的路由都没有 meta（或布局本身出错）时才会用到 */
export const meta: Route.MetaFunction = (args) =>
  args.error ? seo(args, { title: "出错了", noindex: true }) : seo(args);

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        {/* CSS 还没加载时浏览器也按系统深浅色铺底，避免深色下白屏一闪 */}
        <meta name="color-scheme" content="light dark" />
        <Meta />
        <Links />
      </head>
      <body>
        <Providers>{children}</Providers>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <>
      <NavProgress />
      <Outlet />
    </>
  );
}

/** 兜底：前台 / 后台布局各自有更友好的错误页，能冒泡到这里说明布局本身挂了 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const status = isRouteErrorResponse(error) ? error.status : 500;
  return (
    <main className="mx-auto max-w-lg px-4 py-24 text-center">
      <div className="text-5xl font-bold text-primary">{status}</div>
      <p className="mt-3 text-sm text-muted-foreground">
        {status === 404 ? "这一页迷路了" : "页面出了点问题，刷新一下试试？"}
      </p>
      <a href="/" className="mt-6 inline-block text-sm text-primary underline">
        回首页
      </a>
    </main>
  );
}
