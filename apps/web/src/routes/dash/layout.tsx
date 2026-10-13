import { motion, useReducedMotion } from "motion/react";
import { Outlet, redirect, useLocation } from "react-router";
import { DashShell } from "@/components/dash/shell";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/roles";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/layout";

/** 后台鉴权：未登录或非管理员一律跳登录页（每次进入后台路由都会重新校验） */
export async function loader({ request }: Route.LoaderArgs) {
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (!session?.user || !isAdminRole(session.user)) {
    throw redirect("/dash/login");
  }
  return { userName: session.user.name ?? session.user.email };
}

export const meta: Route.MetaFunction = (args) => seo(args, { title: "后台", noindex: true });

export default function AdminLayout({ loaderData }: Route.ComponentProps) {
  const { pathname } = useLocation();
  const reduce = useReducedMotion();
  return (
    <DashShell userName={loaderData.userName}>
      {/* 后台路由切换过渡 */}
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: reduce ? 0 : 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <Outlet />
      </motion.div>
    </DashShell>
  );
}
