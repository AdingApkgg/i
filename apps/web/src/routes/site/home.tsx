import { ReadingHome } from "@/components/public/reading-home";
import { previewPosts, previewShort } from "@/lib/home-content";
import { readHomeSection } from "@/lib/home-content.server";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/home";

export async function loader({ request }: Route.LoaderArgs) {
  const api = serverApi(request);
  const [posts, moments, projects] = await Promise.all([
    readHomeSection(async () => previewPosts(await api.blog.list())),
    readHomeSection(async () => previewShort(await api.moments.list())),
    readHomeSection(async () => previewShort(await api.project.list())),
  ]);
  return { posts, moments, projects };
}

export const meta: Route.MetaFunction = (args) => seo(args, { path: "/" });

export default function Home({ loaderData }: Route.ComponentProps) {
  return <ReadingHome content={loaderData} />;
}
