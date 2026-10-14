import { Card } from "@i/ui";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Pencil } from "lucide-react";
import { Link } from "react-router";
import { formatDate } from "@/lib/format";
import { client } from "@/lib/orpc/client";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/pages";

export const meta: Route.MetaFunction = (args) =>
  seo(args, { title: "整页 · 后台", noindex: true });

/** 整页（音乐、影视等从旧博客导入的独立页面）：id 即前台路径 */
export default function DashPages() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin-pages"],
    queryFn: () => client.page.list(),
  });
  return (
    <div>
      <h1 className="text-2xl font-bold">整页</h1>
      <p className="mt-1 text-sm text-muted-foreground">前台 /music、/movie 这类整页的正文</p>
      <Card className="mt-4 overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">加载中…</div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <Link
                  prefetch="intent"
                  to={`/dash/pages/${p.id}`}
                  className="min-w-0 flex-1 hover:text-primary"
                >
                  <div className="font-medium">{p.title}</div>
                  <div className="text-xs text-muted-foreground">
                    /{p.id} · 更新于 {formatDate(p.updatedAt, { dateStyle: "medium" })}
                  </div>
                </Link>
                <a
                  href={`/${p.id}`}
                  target="_blank"
                  rel="noreferrer"
                  title="在前台查看"
                  className="text-muted-foreground hover:text-primary"
                >
                  <ExternalLink className="size-4" />
                </a>
                <Link
                  prefetch="intent"
                  to={`/dash/pages/${p.id}`}
                  title="编辑"
                  className="text-muted-foreground hover:text-primary"
                >
                  <Pencil className="size-4" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
