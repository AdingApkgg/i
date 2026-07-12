import { Badge, EmptyCard } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { trpcServer } from "@/lib/trpc/server";
import { Card, CardBody } from "@i/ui";

export const metadata = { title: "说说" };

const fmt = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function MomentsPage() {
  const api = await trpcServer();
  const items = await api.moments.list().catch(() => []);
  return (
    <>
      <PageTitle title="说说" subtitle="碎碎念" />
      {items.length === 0 ? (
        <EmptyCard>还没有说说,先去 /dash 记录一句吧 ✿</EmptyCard>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((m) => (
            <Card key={m.id}>
              <CardBody>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  {m.mood && <Badge>{m.mood}</Badge>}
                  <time>{fmt.format(new Date(m.createdAt))}</time>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
