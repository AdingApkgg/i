import { EmptyCard } from "@/components/public/collection";
import { MonitorStatus } from "@/components/public/monitor-status";
import { PageTitle } from "@/components/public/site-header";
import { trpcServer } from "@/lib/trpc/server";

export const metadata = { title: "监控" };

export default async function MonitorPage() {
  const api = await trpcServer();
  const items = await api.monitor.status().catch(() => []);
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
