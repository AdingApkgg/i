import { Button, Card, cn } from "@i/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { ContentBackupButton } from "@/components/dash/content-export";
import { formatDate } from "@/lib/format";
import { client } from "@/lib/orpc/client";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/blog";

export const meta: Route.MetaFunction = (args) =>
  seo(args, { title: "博客 · 后台", noindex: true });

const listKey = ["admin-posts"];

/** 后台文章列表：编辑进全屏编辑器（/dash/blog/:id） */
export default function DashBlog() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: listKey,
    queryFn: () => client.blog.list({ includeDrafts: true }),
  });

  async function remove(id: string, title: string) {
    if (!window.confirm(`确定删除「${title}」？`)) return;
    const prev = qc.getQueryData(listKey);
    qc.setQueryData(listKey, (cur: typeof rows | undefined) =>
      (cur ?? []).filter((r) => r.id !== id),
    );
    try {
      await client.blog.delete({ id });
      toast.success("已删除");
    } catch {
      qc.setQueryData(listKey, prev);
      toast.error("删除失败");
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">博客</h1>
        <div className="flex flex-wrap items-center gap-2">
          <ContentBackupButton />
          <Button asChild>
            <Link prefetch="intent" to="/dash/blog/new">
              <Plus className="size-4" /> 写文章
            </Link>
          </Button>
        </div>
      </div>
      <Card className="mt-4 overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">加载中…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            还没有文章，点右上「写文章」开始 ✿
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    prefetch="intent"
                    to={`/dash/blog/${p.id}`}
                    className="block truncate font-medium hover:text-primary"
                  >
                    {p.title}
                  </Link>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span
                      className={cn(
                        "rounded-pill px-1.5 py-px",
                        p.status === "published" ? "bg-primary/15 text-primary" : "bg-muted",
                      )}
                    >
                      {p.status === "published" ? "已发布" : "草稿"}
                    </span>
                    <span className="truncate">/{p.slug}</span>
                    <span>
                      · {formatDate(p.publishedAt ?? p.updatedAt, { dateStyle: "medium" })}
                    </span>
                  </div>
                </div>
                <a
                  href={`/blog/${p.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  title="在前台查看"
                  className="text-muted-foreground hover:text-primary"
                >
                  <ExternalLink className="size-4" />
                </a>
                <Link
                  prefetch="intent"
                  to={`/dash/blog/${p.id}`}
                  title="编辑"
                  className="text-muted-foreground hover:text-primary"
                >
                  <Pencil className="size-4" />
                </Link>
                <button
                  type="button"
                  title="删除"
                  onClick={() => void remove(p.id, p.title)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
