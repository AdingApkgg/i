import { Collection } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { degradeTo } from "@/lib/degrade.server";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/device";

export async function loader({ request }: Route.LoaderArgs) {
  const api = serverApi(request);
  const items = await api.device.list().catch(degradeTo([]));
  return { items };
}

export const meta: Route.MetaFunction = (args) => seo(args, { title: "设备", path: "/device" });

export default function DevicePage({ loaderData }: Route.ComponentProps) {
  const { items } = loaderData;
  return (
    <>
      <PageTitle title="设备" subtitle="在用装备" />
      <Collection
        items={items.map((d) => ({
          id: d.id,
          title: d.name,
          subtitle: [d.category, d.spec].filter(Boolean).join(" · ") || null,
          status: d.status,
          link: d.link,
        }))}
      />
    </>
  );
}
