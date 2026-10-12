import { data } from "react-router";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/not-found";

/** 未匹配的路径：抛 404，由前台布局的 ErrorBoundary 渲染（状态码真实为 404） */
export function loader() {
  throw data(null, { status: 404 });
}

export const meta: Route.MetaFunction = (args) => seo(args, { title: "404", noindex: true });

export default function NotFound() {
  return null;
}
