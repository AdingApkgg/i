import { Card, CardBody } from "@i/ui";
import { Link } from "react-router";
import { Stagger, StaggerItem } from "@/components/motion";
import { Badge, EmptyCard } from "@/components/public/collection";
import { PageTitle } from "@/components/public/site-header";
import { degradeTo } from "@/lib/degrade.server";
import { formatDate } from "@/lib/format";
import { serverApi } from "@/lib/orpc/api.server";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/blog";

const fmtDate = (d: Date | string) => formatDate(d);

export async function loader({ request }: Route.LoaderArgs) {
  const api = serverApi(request);
  const items = await api.blog.list().catch(degradeTo([]));
  return { items };
}

export const meta: Route.MetaFunction = (args) => seo(args, { title: "博客", path: "/blog" });

export default function BlogPage({ loaderData }: Route.ComponentProps) {
  const { items } = loaderData;
  return (
    <>
      <PageTitle title="博客" subtitle="文章" />
      {items.length === 0 ? (
        <EmptyCard>还没有文章,先去 /dash 写一篇吧 ✿</EmptyCard>
      ) : (
        <Stagger className="flex flex-col gap-4">
          {items.map((p) => (
            <StaggerItem key={p.slug} hover>
              <Link to={`/blog/${p.slug}`}>
                <Card className="transition hover:shadow-md">
                  <CardBody>
                    <div className="font-semibold">{p.title}</div>
                    {p.excerpt && (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.excerpt}</p>
                    )}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {(p.tags ?? []).map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {fmtDate(p.publishedAt ?? p.createdAt)}
                      </span>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </>
  );
}
