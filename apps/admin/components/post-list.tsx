"use client";

import { deletePost, listPosts, type Post } from "@i/api-client";
import { Badge, Button, Card, Section } from "@i/ui";
import { useCallback, useEffect, useState } from "react";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function StatusBadge({ status }: { status: string }) {
  const published = status === "published";
  return (
    <Badge variant={published ? "accent" : "soft"}>
      {published ? "已发布" : "草稿"}
    </Badge>
  );
}

/**
 * NOTE: listPosts() returns only *published* posts (the public endpoint), so
 * drafts created here won't appear in this list until published. Called out in
 * the manifest as a known backend limitation.
 */
export function PostList({
  onNew,
  onEdit,
}: {
  onNew: () => void;
  onEdit: (slug: string) => void;
}) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setPosts(await listPosts());
    } catch {
      setError("加载文章失败");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(post: Post) {
    if (!window.confirm(`确定删除《${post.title}》？此操作不可撤销。`)) return;
    setDeleting(post.slug);
    try {
      await deletePost(post.slug);
      setPosts((prev) => prev?.filter((p) => p.slug !== post.slug) ?? null);
    } catch {
      setError("删除失败");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <Section
      title="文章"
      moreLabel="新建文章"
      onMore={onNew}
    >
      {error && (
        <Card className="mb-4 border-red-300 text-sm text-red-500">
          {error}{" "}
          <button
            type="button"
            onClick={() => void load()}
            className="underline underline-offset-2"
          >
            重试
          </button>
        </Card>
      )}

      {posts == null && !error && (
        <Card className="text-sm text-muted">加载中…</Card>
      )}

      {posts != null && posts.length === 0 && (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <p className="text-sm text-muted">还没有已发布的文章。</p>
          <Button onClick={onNew}>新建文章</Button>
        </Card>
      )}

      {posts != null && posts.length > 0 && (
        <Card flush className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-5 py-3 font-medium">标题</th>
                <th className="hidden px-5 py-3 font-medium sm:table-cell">
                  Slug
                </th>
                <th className="px-5 py-3 font-medium">状态</th>
                <th className="hidden px-5 py-3 font-medium md:table-cell">
                  更新时间
                </th>
                <th className="px-5 py-3 text-right font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr
                  key={post.id}
                  className="border-b border-line last:border-0 transition hover:bg-soft/30"
                >
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={() => onEdit(post.slug)}
                      className="text-left font-medium text-ink hover:text-accent"
                    >
                      {post.title}
                    </button>
                  </td>
                  <td className="hidden px-5 py-3 font-mono text-xs text-muted sm:table-cell">
                    {post.slug}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={post.status} />
                  </td>
                  <td className="hidden px-5 py-3 text-muted md:table-cell">
                    {fmtDate(post.updated_at)}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="soft"
                        size="sm"
                        onClick={() => onEdit(post.slug)}
                      >
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:bg-red-50 hover:text-red-600"
                        disabled={deleting === post.slug}
                        onClick={() => void remove(post)}
                      >
                        {deleting === post.slug ? "删除中…" : "删除"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </Section>
  );
}
