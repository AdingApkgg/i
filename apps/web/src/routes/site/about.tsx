import { data } from "react-router";
import { ArticleBody } from "@/components/content/article-body";
import { PageTitle } from "@/components/public/site-header";
import { loadArticleBody } from "@/lib/content/load.server";
import { degradeTo } from "@/lib/degrade.server";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/about";

const prose =
  "prose-content space-y-3 text-body leading-relaxed [&_a]:text-primary [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mt-5 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:mt-4 [&_h4]:font-semibold [&_img]:rounded-md [&_li]:my-1 [&_ul]:list-disc [&_ul]:pl-5";

export async function loader({ request }: Route.LoaderArgs) {
  const page = await serverApi(request).page.get({ id: "about" }).catch(degradeTo(null));
  if (!page) throw data(null, { status: 404 });
  const { contentMd, content } = page;
  return { page, body: await loadArticleBody({ content, contentMd }) };
}

export const meta: Route.MetaFunction = (args) => {
  const page = args.loaderData?.page;
  if (!page) return seo(args, { title: "404", noindex: true });
  return seo(args, { title: page.title, path: "/about" });
};

export default function Page({ loaderData }: Route.ComponentProps) {
  const { page, body } = loaderData;
  return (
    <>
      <PageTitle title={page.title} />
      <ArticleBody body={body} className={prose} />
    </>
  );
}
