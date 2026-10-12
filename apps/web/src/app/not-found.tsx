import { NotFoundView } from "@/components/public/not-found-view";
import SiteLayout from "./(site)/layout";

export const metadata = { title: "404" };

/** 全站未匹配路由：根 layout 下没有前台外壳，这里补上导航 + 看板娘。 */
export default function NotFound() {
  return (
    <SiteLayout>
      <NotFoundView />
    </SiteLayout>
  );
}
