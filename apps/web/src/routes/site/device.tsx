import { Card, CardBody } from "@i/ui";
import { PageTitle } from "@/components/public/site-header";
import { degradeTo } from "@/lib/degrade.server";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import { thumb } from "@/lib/thumb";
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
      <div className="grid gap-5 sm:grid-cols-2">
        {items.map((d) => (
          <Card key={d.id} className="overflow-hidden">
            {d.imageUrl && (
              <img
                src={thumb(d.imageUrl, 960)}
                alt={d.name}
                loading="lazy"
                className="h-52 w-full bg-soft object-contain"
              />
            )}
            <CardBody className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="min-w-0 break-words text-lg font-semibold">{d.name}</h2>
                <span className="rounded-full bg-soft px-2 py-1 text-xs text-primary">
                  {d.status}
                </span>
              </div>
              {d.category && <p className="text-sm text-muted-foreground">{d.category}</p>}
              {d.spec && (
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{d.spec}</p>
              )}
              {d.acquired && <p className="text-xs text-muted-foreground">入手：{d.acquired}</p>}
              {d.note && (
                <p className="whitespace-pre-wrap break-words border-t border-border pt-3 text-sm text-muted-foreground">
                  {d.note}
                </p>
              )}
              {d.link && (
                <a
                  href={d.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm text-primary hover:underline"
                >
                  相关链接 ↗
                </a>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
      {items.length === 0 && <p className="text-sm text-muted-foreground">还没有设备记录。</p>}
    </>
  );
}
