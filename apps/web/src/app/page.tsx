import { NAV_DOMAINS, siteConfig } from "@i/config";
import { Card, CardBody } from "@i/ui";
import Link from "next/link";
import { trpcServer } from "@/lib/trpc/server";

export default async function Home() {
  const api = await trpcServer();
  const health = await api.health.status().catch(() => ({ db: false, redis: false, posts: 0 }));
  const posts = await api.post.list().catch(() => []);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      {/* hero */}
      <Card className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full"
          style={{ background: "radial-gradient(circle, var(--primary), transparent 70%)", opacity: 0.18 }}
        />
        <CardBody className="p-8">
          <div className="flex items-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-soft px-3 py-1 font-medium text-primary">
              <span className="size-1.5 rounded-full bg-primary" /> 在线
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-bold tracking-wide">{siteConfig.title}</h1>
          <div className="text-sm font-semibold text-primary">{siteConfig.handle}</div>
          <p className="mt-3 text-[15px] text-muted-foreground">{siteConfig.tagline}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {NAV_DOMAINS.map((d) => (
              <Link
                key={d.key}
                href={d.path}
                className="rounded-pill bg-soft px-3.5 py-1.5 text-[13px] font-medium text-accent-foreground transition hover:-translate-y-0.5 hover:brightness-95"
              >
                {d.label}
              </Link>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* system status — proves tRPC + Prisma + Redis end to end */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <StatTile label="数据库" ok={health.db} />
        <StatTile label="Redis" ok={health.redis} />
        <Card>
          <CardBody className="py-4 text-center">
            <div className="text-2xl font-bold text-primary">{health.posts}</div>
            <div className="text-xs text-muted-foreground">文章</div>
          </CardBody>
        </Card>
      </div>

      {/* recent posts */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">最近文章</h2>
        {posts.length === 0 ? (
          <Card>
            <CardBody className="py-8 text-center text-sm text-muted-foreground">
              还没有文章,先去 /dash 写一篇吧 ✿
            </CardBody>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {posts.map((p) => (
              <Link key={p.id} href={`/blog/${p.slug}`}>
                <Card className="h-full transition hover:-translate-y-0.5 hover:shadow-md">
                  <CardBody>
                    <div className="font-semibold">{p.title}</div>
                    {p.excerpt && (
                      <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{p.excerpt}</p>
                    )}
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function StatTile({ label, ok }: { label: string; ok: boolean }) {
  return (
    <Card>
      <CardBody className="py-4 text-center">
        <div className={`text-2xl font-bold ${ok ? "text-primary" : "text-destructive"}`}>
          {ok ? "✓" : "✗"}
        </div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardBody>
    </Card>
  );
}
