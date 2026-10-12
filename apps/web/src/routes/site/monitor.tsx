import { EmptyCard } from "@/components/public/collection";
import { MonitorStatus } from "@/components/public/monitor-status";
import { PageTitle } from "@/components/public/site-header";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/monitor";

export async function loader({ request }: Route.LoaderArgs) {
  const api = serverApi(request);
  const items = await api.monitor.status().catch(() => []);
  return { items };
}

export const meta: Route.MetaFunction = (args) => seo(args, { title: "监控", path: "/monitor" });

export default function MonitorPage({ loaderData }: Route.ComponentProps) {
  const { items } = loaderData;
  return (
    <>
      <PageTitle title="监控" subtitle="站点可用性" />
      {items.length === 0 ? (
        <EmptyCard>还没有监控项,先去 /dash 添加吧 ✿</EmptyCard>
      ) : (
        <MonitorStatus initial={items} />
      )}
    </>
  );
}
