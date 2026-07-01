"use client";

import {
  createPost,
  getPost,
  updatePost,
  type UpsertPost,
} from "@i/api-client";
import { Badge, Button, Card, Section } from "@i/ui";
import { useEffect, useState } from "react";
import { Markdown } from "./markdown";

const inputCls =
  "w-full rounded-card border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:shadow-soft-sm";

/** Slugify a title into a URL-safe slug (fallback for the create form). */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w一-龥]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Create/edit form. When `slug` is provided we prefill via getPost() and PUT on
 * save; otherwise we POST a new post. On success `onDone` returns to the list.
 */
export function PostEditor({
  slug,
  onDone,
  onCancel,
}: {
  slug?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const editing = slug != null;

  const [form, setForm] = useState<UpsertPost>({
    slug: "",
    title: "",
    content_md: "",
    status: "draft",
  });
  // Track whether the user has hand-edited the slug so auto-slug stops then.
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    let alive = true;
    (async () => {
      try {
        const post = await getPost(slug);
        if (!alive) return;
        setForm({
          slug: post.slug,
          title: post.title,
          content_md: post.content_md,
          status: post.status,
        });
        setSlugTouched(true);
      } catch {
        if (alive) setError("加载文章失败");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [editing, slug]);

  function patch(next: Partial<UpsertPost>) {
    setForm((prev) => ({ ...prev, ...next }));
  }

  function onTitle(title: string) {
    patch({ title });
    if (!editing && !slugTouched) patch({ slug: slugify(title) });
  }

  const published = form.status === "published";

  async function save() {
    if (saving) return;
    if (!form.title.trim() || !form.slug.trim()) {
      setError("标题和 slug 不能为空");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const body: UpsertPost = {
        slug: form.slug.trim(),
        title: form.title.trim(),
        content_md: form.content_md,
        status: form.status,
      };
      if (editing) await updatePost(slug, body);
      else await createPost(body);
      onDone();
    } catch {
      setError("保存失败");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <Section title={editing ? "编辑文章" : "新建文章"}>
        <Card className="text-sm text-muted">加载中…</Card>
      </Section>
    );
  }

  return (
    <Section
      title={editing ? "编辑文章" : "新建文章"}
      moreLabel="← 返回列表"
      onMore={onCancel}
    >
      <div className="space-y-4">
        <Card className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted">
                标题
              </span>
              <input
                value={form.title}
                onChange={(e) => onTitle(e.target.value)}
                placeholder="文章标题"
                className={inputCls}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-muted">
                Slug
              </span>
              <input
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  patch({ slug: e.target.value });
                }}
                disabled={editing}
                placeholder="my-first-post"
                className={`${inputCls} font-mono disabled:opacity-60`}
              />
              {editing && (
                <span className="mt-1 block text-xs text-muted">
                  slug 不可修改
                </span>
              )}
            </label>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted">状态</span>
            <button
              type="button"
              role="switch"
              aria-checked={published}
              onClick={() => patch({ status: published ? "draft" : "published" })}
              className="inline-flex items-center gap-2"
            >
              <span
                className={`relative h-6 w-11 rounded-pill transition ${
                  published ? "bg-accent" : "bg-line"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-soft-sm transition ${
                    published ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </span>
              <Badge variant={published ? "accent" : "soft"}>
                {published ? "已发布" : "草稿"}
              </Badge>
            </button>
          </div>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col">
            <span className="mb-1.5 block text-sm font-medium text-muted">
              Markdown 内容
            </span>
            <textarea
              value={form.content_md}
              onChange={(e) => patch({ content_md: e.target.value })}
              placeholder="# 标题\n\n用 Markdown 书写…"
              spellCheck={false}
              className="min-h-[28rem] w-full flex-1 resize-y rounded-card border border-line bg-surface p-4 font-mono text-[13px] leading-relaxed text-ink outline-none transition focus:border-accent focus:shadow-soft-sm"
            />
          </div>
          <div className="flex flex-col">
            <span className="mb-1.5 block text-sm font-medium text-muted">
              预览
            </span>
            <Card className="min-h-[28rem] flex-1 overflow-auto">
              {form.content_md.trim() ? (
                <Markdown>{form.content_md}</Markdown>
              ) : (
                <p className="text-sm text-muted">预览将显示在这里…</p>
              )}
            </Card>
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "保存中…" : editing ? "保存修改" : "创建文章"}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            取消
          </Button>
        </div>
      </div>
    </Section>
  );
}
