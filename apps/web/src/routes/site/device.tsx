import { Card, CardBody } from "@i/ui";
import { Boxes, ExternalLink, Laptop, Smartphone, Sparkles, Undo2 } from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/motion";
import { Badge, EmptyCard } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { degradeTo } from "@/lib/degrade.server";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import { thumbProps } from "@/lib/thumb";
import type { Route } from "./+types/device";

export async function loader({ request }: Route.LoaderArgs) {
  const api = serverApi(request);
  const items = await api.device.list().catch(degradeTo([]));
  return { items };
}

export const meta: Route.MetaFunction = (args) => seo(args, { title: "设备", path: "/device" });

type Device = Route.ComponentProps["loaderData"]["items"][number];

const CATEGORY_ORDER = ["电脑", "手机", "平板", "影音", "外设"];

const CATEGORY_ICON: Record<string, typeof Laptop> = {
  电脑: Laptop,
  手机: Smartphone,
};

const STATUS_STYLE: Record<string, string> = {
  在用: "bg-primary/12 text-primary ring-primary/25",
  想要: "bg-info/12 text-info-strong ring-info/25 dark:text-info-contrast",
  退役: "bg-soft text-muted-foreground ring-border",
};

const STATUS_ICON: Record<string, typeof Sparkles> = {
  在用: Sparkles,
  想要: Sparkles,
  退役: Undo2,
};

interface Group {
  category: string;
  items: Device[];
}

function groupBy(items: Device[]): Group[] {
  const groups = new Map<string, Device[]>();
  for (const item of items) {
    const key = item.category?.trim() || "其他";
    const bucket = groups.get(key);
    if (bucket) bucket.push(item);
    else groups.set(key, [item]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => {
      const ia = CATEGORY_ORDER.indexOf(a);
      const ib = CATEGORY_ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b, "zh-CN");
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    })
    .map(([category, list]) => ({ category, items: list }));
}

function DeviceCard({ device }: { device: Device }) {
  const Icon = CATEGORY_ICON[device.category ?? ""] ?? Boxes;
  const StatusIcon = STATUS_ICON[device.status] ?? Sparkles;
  const statusStyle = STATUS_STYLE[device.status] ?? STATUS_STYLE.退役;
  const card = (
    <Card className="group h-full overflow-hidden transition hover:border-primary/40 hover:shadow-md">
      <div className="relative aspect-4/3 w-full overflow-hidden bg-gradient-to-br from-soft via-card to-soft">
        {device.imageUrl ? (
          <img
            {...thumbProps(
              device.imageUrl,
              [320, 640, 960],
              "(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw",
            )}
            alt={device.name}
            loading="lazy"
            className="size-full object-cover transition duration-500 group-hover:scale-103"
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-2 text-primary/35">
            <Icon className="size-10" strokeWidth={1.5} />
            <span className="text-caption tracking-kicker uppercase">
              {device.category ?? "设备"}
            </span>
          </div>
        )}
        <span
          className={`absolute top-3 left-3 inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-caption font-medium ring-1 ring-inset backdrop-blur ${statusStyle}`}
        >
          <StatusIcon className="size-3" />
          {device.status}
        </span>
        {device.link && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-pill bg-card/80 px-2 py-0.5 text-caption font-medium text-primary ring-1 ring-inset ring-primary/25 backdrop-blur">
            官网
            <ExternalLink className="size-3" />
          </span>
        )}
      </div>
      <CardBody className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 text-base font-semibold break-words">{device.name}</h3>
          {device.acquired && (
            <span className="shrink-0 text-xs text-muted-foreground">入手：{device.acquired}</span>
          )}
        </div>
        {device.spec && (
          <p className="rounded-lg bg-soft px-3 py-2 text-xs leading-relaxed break-words whitespace-pre-wrap text-muted-foreground">
            {device.spec}
          </p>
        )}
        {device.note && (
          <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">{device.note}</p>
        )}
        {device.link && (
          <span className="inline-flex items-center gap-1 text-sm text-primary group-hover:underline">
            <ExternalLink className="size-3.5" />
            查看官网
          </span>
        )}
      </CardBody>
    </Card>
  );

  if (!device.link) return card;
  return (
    <a
      href={device.link}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${device.name} 官网`}
      className="block h-full rounded-xl outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary"
    >
      {card}
    </a>
  );
}

export default function DevicePage({ loaderData }: Route.ComponentProps) {
  const { items } = loaderData;
  const groups = groupBy(items);
  const inUse = items.filter((d) => d.status === "在用").length;

  return (
    <>
      <PageTitle title="设备" subtitle="在用装备" />
      {items.length === 0 ? (
        <EmptyCard>还没有设备记录。</EmptyCard>
      ) : (
        <>
          <FadeIn>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
              <Badge>共 {items.length} 台</Badge>
              <span>在用 {inUse} 台</span>
              <span className="hidden sm:inline">
                · 日常真正在用的东西，性能和手感都按自己的习惯挑
              </span>
            </div>
          </FadeIn>
          {groups.map((group, index) => {
            const Icon = CATEGORY_ICON[group.category] ?? Boxes;
            return (
              <FadeIn key={group.category} delay={0.05 + index * 0.05}>
                <section className="mt-9 first:mt-0">
                  <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
                    <Icon className="size-4 text-primary" />
                    <h2 className="text-sm font-semibold tracking-wide">{group.category}</h2>
                    <span className="text-xs text-muted-foreground">{group.items.length}</span>
                  </div>
                  <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {group.items.map((device) => (
                      <StaggerItem key={device.id} hover>
                        <DeviceCard device={device} />
                      </StaggerItem>
                    ))}
                  </Stagger>
                </section>
              </FadeIn>
            );
          })}
        </>
      )}
    </>
  );
}
