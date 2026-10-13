import { Collection } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { degradeTo } from "@/lib/degrade.server";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/vn";

export async function loader({ request }: Route.LoaderArgs) {
  const api = serverApi(request);
  const items = await api.vn.list().catch(degradeTo([]));
  return { items };
}

export const meta: Route.MetaFunction = (args) => seo(args, { title: "视觉小说", path: "/vn" });

export default function VnPage({ loaderData }: Route.ComponentProps) {
  const { items } = loaderData;
  return (
    <>
      <PageTitle title="视觉小说" subtitle="Galgame 记录" />
      <Collection
        items={items.map((t) => ({
          id: t.id,
          title: t.title,
          subtitle: t.brand || null,
          status: t.status,
          coverUrl: t.coverUrl,
          rating: t.rating,
          link: t.link,
        }))}
      />
    </>
  );
}
