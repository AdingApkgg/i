import { Badge, EmptyCard } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { trpcServer } from "@/lib/trpc/server";
import { Card, CardBody } from "@i/ui";

export const metadata = { title: "监控" };

export default async function MonitorPage() {
  const api = await trpcServer();
  const items = await api.monitor.list().catch(() => []);
  return (
    <>
      <PageTitle title="监控" subtitle="站点可用性" />
      {items.length === 0 ? (
        <EmptyCard>还没有监控项,先去 /dash 添加吧 ✿</EmptyCard>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((m) => (
            <Card key={`${m.name}-${m.target}`}>
              <CardBody className="flex items-center gap-3">
                <span
                  className={`size-2.5 shrink-0 rounded-full ${m.enabled ? "bg-green-500" : "bg-gray-400"}`}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{m.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{m.target}</div>
                </div>
                <Badge>{m.kind}</Badge>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
