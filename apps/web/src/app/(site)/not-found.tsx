import { NotFoundView } from "@/components/public/not-found-view";

export const metadata = { title: "404" };

/** (site) 内页面调用 notFound() 时渲染，外壳由 (site)/layout 提供。 */
export default function SiteNotFound() {
  return <NotFoundView />;
}
