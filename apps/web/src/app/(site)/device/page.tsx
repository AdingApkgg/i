import { Collection } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { trpcServer } from "@/lib/trpc/server";

export const metadata = { title: "设备" };

export default async function DevicePage() {
  const api = await trpcServer();
  const items = await api.device.list().catch(() => []);
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
