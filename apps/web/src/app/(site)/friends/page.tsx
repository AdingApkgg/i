import { EmptyCard } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { trpcServer } from "@/lib/trpc/server";
import { Card } from "@i/ui";

export const metadata = { title: "友链" };

export default async function FriendsPage() {
  const api = await trpcServer();
  const items = await api.friends.list().catch(() => []);
  const links = items.filter((f) => f.status === "active");
  return (
    <>
      <PageTitle title="友链" subtitle="朋友们" />
      {links.length === 0 ? (
        <EmptyCard>还没有友链,先去 /dash 添加吧 ✿</EmptyCard>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
          {links.map((f) => (
            <a
              key={f.name}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Card className="flex h-full items-center gap-3 p-3 transition hover:-translate-y-0.5 hover:shadow-md">
                {f.avatarUrl ? (
                  // biome-ignore lint/a11y/useAltText: alt via title
                  <img
                    src={f.avatarUrl}
                    alt={f.name}
                    title={f.name}
                    loading="lazy"
                    className="size-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-soft text-primary/40">
                    ✿
                  </div>
                )}
                <div className="min-w-0">
                  <div className="truncate font-semibold">{f.name}</div>
                  {f.description && (
                    <div className="line-clamp-2 text-xs text-muted-foreground">
                      {f.description}
                    </div>
                  )}
                </div>
              </Card>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
