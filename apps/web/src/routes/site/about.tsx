import { data } from "react-router";
import { HexoContent } from "@/components/hexo/content";
import { PageTitle } from "@/components/public/site-header";
import { degradeTo } from "@/lib/degrade.server";
import { compileHexo } from "@/lib/hexo/compile.server";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/about";

const prose =
  "space-y-3 text-[15px] leading-relaxed [&_a]:text-primary [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:mt-4 [&_h4]:font-semibold [&_img]:rounded-[var(--radius-md)]";

/** 关于页：整页内容存在 Page(id="about")，由后台维护，和 music/movie 走同一条导入渲染链路。 */
export async function loader({ request }: Route.LoaderArgs) {
  const page = await serverApi(request).page.get({ id: "about" }).catch(degradeTo(null));
  if (!page) throw data(null, { status: 404 });
  return { page: { source: page.contentMd, code: await compileHexo(page.contentMd) } };
}

export const meta: Route.MetaFunction = (args) =>
  args.loaderData
    ? seo(args, { title: "关于", path: "/about" })
    : seo(args, { title: "404", noindex: true });

export default function AboutPage({ loaderData }: Route.ComponentProps) {
  const { page } = loaderData;
  return (
    <>
      <PageTitle title="关于" subtitle="关于我和这个站" />
      <HexoContent code={page.code} source={page.source} className={prose} />
    </>
  );
}
