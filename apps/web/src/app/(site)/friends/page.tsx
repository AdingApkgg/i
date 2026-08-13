import { siteConfig } from "@i/config";
import { Card, cn } from "@i/ui";
import { UserRound } from "lucide-react";
import { Stagger, StaggerItem } from "@/components/motion";
import { EmptyCard } from "@/components/public/collection";
import { FriendApply } from "@/components/public/friend-apply";
import { PageTitle } from "@/components/public/site-header";
import { trpcServer } from "@/lib/trpc/server";

export const metadata = { title: "友链" };

interface FriendItem {
  id: string;
  name: string;
  url: string;
  avatarUrl: string | null;
  description: string | null;
  group: string | null;
  status: string;
}

function FriendCard({ f, dim }: { f: FriendItem; dim?: boolean }) {
  return (
    <StaggerItem hover className="h-full">
      <a href={f.url} target="_blank" rel="noopener noreferrer" className="block h-full">
        <Card
          className={cn(
            "flex h-full items-center gap-3 p-3 transition hover:shadow-md",
            dim && "opacity-60 grayscale hover:opacity-90 hover:grayscale-0",
          )}
        >
          {f.avatarUrl ? (
            // biome-ignore lint/performance/noImgElement: 外站头像，沿用原生 img
            <img
              src={f.avatarUrl}
              alt={f.name}
              title={f.name}
              loading="lazy"
              className="size-10 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-soft text-primary/40">
              <UserRound className="size-4" />
            </div>
          )}
          <div className="min-w-0">
            <div className="truncate font-semibold">{f.name}</div>
            {f.description && (
              <div className="line-clamp-2 text-xs text-muted-foreground">{f.description}</div>
            )}
          </div>
        </Card>
      </a>
    </StaggerItem>
  );
}

export default async function FriendsPage() {
  const api = await trpcServer();
  const items = (await api.friends.list().catch(() => [])) as FriendItem[];
  const active = items.filter((f) => f.status === "active");
  const outdate = items.filter((f) => f.status === "outdate");

  // 按分组分区展示，组序 = 组内最靠前条目的顺序（list 已按 sortOrder 排好）。
  const groups = new Map<string, FriendItem[]>();
  for (const f of active) {
    const g = f.group?.trim() || "朋友";
    const list = groups.get(g);
    if (list) list.push(f);
    else groups.set(g, [f]);
  }

  const site = {
    name: siteConfig.title,
    url: process.env.NEXT_PUBLIC_SITE_URL ?? siteConfig.url,
    description: siteConfig.description,
  };

  return (
    <>
      <PageTitle title="友链" subtitle="朋友们" />
      {active.length === 0 && outdate.length === 0 ? (
        <EmptyCard>还没有友链，来做第一个朋友吧 ✿</EmptyCard>
      ) : (
        <div className="space-y-8">
          {[...groups.entries()].map(([name, list]) => (
            <section key={name}>
              <h2 className="mb-3 flex items-baseline gap-2 text-lg font-bold">
                {name}
                <span className="text-xs font-normal text-muted-foreground">{list.length}</span>
              </h2>
              <Stagger className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {list.map((f) => (
                  <FriendCard key={f.id} f={f} />
                ))}
              </Stagger>
            </section>
          ))}
          {outdate.length > 0 && (
            <section>
              <h2 className="mb-3 flex items-baseline gap-2 text-lg font-bold text-muted-foreground">
                暂时失联
                <span className="text-xs font-normal">链接好像打不开了，等它们回来 ✿</span>
              </h2>
              <Stagger className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {outdate.map((f) => (
                  <FriendCard key={f.id} f={f} dim />
                ))}
              </Stagger>
            </section>
          )}
        </div>
      )}
      <FriendApply site={site} />
    </>
  );
}
