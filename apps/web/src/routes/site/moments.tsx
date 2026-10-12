import { Card, CardBody } from "@i/ui";
import { Stagger, StaggerItem } from "@/components/motion";
import { Badge, EmptyCard } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { formatDate } from "@/lib/format";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/moments";

const fmt = (d: Date | string) =>
  formatDate(d, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export async function loader({ request }: Route.LoaderArgs) {
  const api = serverApi(request);
  const items = await api.moments.list().catch(() => []);
  return { items };
}

export const meta: Route.MetaFunction = (args) => seo(args, { title: "说说", path: "/moments" });

export default function MomentsPage({ loaderData }: Route.ComponentProps) {
  const { items } = loaderData;
  return (
    <>
      <PageTitle title="说说" subtitle="碎碎念" />
      {items.length === 0 ? (
        <EmptyCard>还没有说说,先去 /dash 记录一句吧 ✿</EmptyCard>
      ) : (
        <Stagger className="flex flex-col gap-4">
          {items.map((m) => (
            <StaggerItem key={m.id}>
              <Card>
                <CardBody>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    {m.mood && <Badge>{m.mood}</Badge>}
                    <time>{fmt(m.createdAt)}</time>
                  </div>
                </CardBody>
              </Card>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </>
  );
}
