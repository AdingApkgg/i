import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { isRouteErrorResponse, Outlet, useLocation, useRevalidator } from "react-router";
import { PlayerProvider } from "@/components/player/player-context";
import { ErrorView } from "@/components/public/error-view";
import { MascotWidget } from "@/components/public/mascot-widget";
import { NotFoundView } from "@/components/public/not-found-view";
import { SiteHeader } from "@/components/public/site-header";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/layout";

/** 前台外壳：播放器、顶栏、看板娘。正常页面和错误页共用。 */
function Chrome({ children }: { children: ReactNode }) {
  return (
    <PlayerProvider>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <MascotWidget />
    </PlayerProvider>
  );
}

/**
 * 子路由出错（含 404）时，React Router 只用错误边界所在路由的 meta，
 * 页面自己的 meta 不会生效 —— 这里补上标题和 noindex（同 Next 对 404 的处理）。
 * 正常情况下子路由的 meta 会整体覆盖这里。
 */
export const meta: Route.MetaFunction = (args) => {
  if (!args.error) return seo(args);
  const notFound = isRouteErrorResponse(args.error) && args.error.status === 404;
  return seo(args, { title: notFound ? "404" : "出错了", noindex: true });
};

export default function SiteLayout() {
  const { pathname } = useLocation();
  const reduce = useReducedMotion();
  return (
    <Chrome>
      {/* 路由切换时的页面过渡（按路径重新挂载） */}
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: reduce ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        <Outlet />
      </motion.div>
    </Chrome>
  );
}

/** 页面 loader 抛 404 或渲染出错时，仍保留前台外壳 */
export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const { revalidate } = useRevalidator();
  return (
    <Chrome>
      {isRouteErrorResponse(error) && error.status === 404 ? (
        <NotFoundView />
      ) : (
        <ErrorView error={error} onRetry={() => void revalidate()} />
      )}
    </Chrome>
  );
}
