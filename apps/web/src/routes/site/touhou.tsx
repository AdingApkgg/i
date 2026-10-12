import { Collection } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/touhou";

export async function loader({ request }: Route.LoaderArgs) {
  const api = serverApi(request);
  const items = await api.touhou.list().catch(() => []);
  return { items };
}

export const meta: Route.MetaFunction = (args) => seo(args, { title: "东方", path: "/touhou" });

export default function TouhouPage({ loaderData }: Route.ComponentProps) {
  const { items } = loaderData;
  return (
    <>
      <PageTitle title="东方" subtitle="东方 Project" />
      <Collection
        items={items.map((t) => ({
          id: t.id,
          title: t.title,
          subtitle: t.category,
          status: t.status,
          coverUrl: t.coverUrl,
          rating: t.rating,
          link: t.link,
        }))}
      />
    </>
  );
}
