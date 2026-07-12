import Link from "next/link";
import { Badge, EmptyCard } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { trpcServer } from "@/lib/trpc/server";
import { Card, CardBody } from "@i/ui";

export const metadata = { title: "博客" };

const fmtDate = (d: Date | string) => new Intl.DateTimeFormat("zh-CN").format(new Date(d));

export default async function BlogPage() {
  const api = await trpcServer();
  const items = await api.blog.list().catch(() => []);
  return (
    <>
      <PageTitle title="博客" subtitle="文章" />
      {items.length === 0 ? (
        <EmptyCard>还没有文章,先去 /dash 写一篇吧 ✿</EmptyCard>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`}>
              <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
                <CardBody>
                  <div className="font-semibold">{p.title}</div>
                  {p.excerpt && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.excerpt}</p>
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {p.tags.map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {fmtDate(p.publishedAt ?? p.createdAt)}
                    </span>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
