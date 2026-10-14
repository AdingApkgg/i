import { Button, cn } from "@i/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Editor } from "@tiptap/react";
import {
  ArrowLeft,
  ExternalLink,
  ImagePlus,
  LoaderCircle,
  Save,
  Send,
  Undo2,
  X,
} from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Link, useBlocker, useNavigate } from "react-router";
import { toast } from "sonner";
import { pickImages, uploadImage } from "@/components/editor/upload";
import { emptyDoc, type RichDoc } from "@/lib/content/types";
import { client } from "@/lib/orpc/client";
import { orpcErrText } from "@/lib/orpc/errors";
import { seo } from "@/lib/seo";
import { thumb } from "@/lib/thumb";
import type { Route } from "./+types/blog-edit";

// 编辑器单独成包，只有进编辑页才下载
const RichEditor = lazy(() =>
  import("@/components/editor/rich-editor").then((m) => ({ default: m.RichEditor })),
);

export const meta: Route.MetaFunction = (args) =>
  seo(args, {
    title: args.params.id === "new" ? "写文章 · 后台" : "编辑文章 · 后台",
    noindex: true,
  });

type Post = Awaited<ReturnType<typeof client.blog.byId>>;

export default function BlogEditPage({ params }: Route.ComponentProps) {
  const isNew = params.id === "new";
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-post", params.id],
    queryFn: () => client.blog.byId({ id: params.id }),
    enabled: !isNew,
    // 编辑中不要因为切回窗口就重新拉取覆盖状态
    refetchOnWindowFocus: false,
  });
  if (!isNew && isLoading)
    return <div className="h-[70vh] animate-pulse rounded-[var(--radius-lg)] bg-muted/50" />;
  if (!isNew && (isError || !data))
    return <div className="text-sm text-muted-foreground">文章不存在或加载失败</div>;
  return <PostEditor key={params.id} post={isNew ? null : data!} />;
}

interface Meta {
  title: string;
  slug: string;
  excerpt: string;
  coverUrl: string;
  tags: string;
  status: "draft" | "published";
}

interface Draft {
  meta: Meta;
  doc: RichDoc;
  at: number;
}

const draftKey = (id: string | undefined) => `post-draft:${id ?? "new"}`;

function readDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

const input =
  "w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30";

function PostEditor({ post }: { post: Post | null }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const key = draftKey(post?.id);
  const legacyOnly = post != null && !post.content && !!post.contentMd;

  const [meta, setMeta] = useState<Meta>(() => ({
    title: post?.title ?? "",
    slug: post?.slug ?? Date.now().toString(36),
    excerpt: post?.excerpt ?? "",
    coverUrl: post?.coverUrl ?? "",
    tags: (post?.tags ?? []).join(", "),
    status: (post?.status as Meta["status"]) ?? "draft",
  }));
  const [initialDoc, setInitialDoc] = useState<RichDoc>(
    () => (post?.content as RichDoc | null) ?? emptyDoc(),
  );
  const [editorKey, setEditorKey] = useState(0);
  const docRef = useRef<RichDoc>(initialDoc);
  const editorRef = useRef<Editor | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(post ? new Date(post.updatedAt) : null);
  const [coverBusy, setCoverBusy] = useState(false);

  // 本地草稿：每次改动后 0.8 秒写一份，刷新 / 崩溃后能恢复
  const draftTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const touch = useCallback(() => {
    setDirty(true);
    clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(
          key,
          JSON.stringify({ meta: metaRef.current, doc: docRef.current, at: Date.now() }),
        );
      } catch {
        // 存满或隐私模式：不影响编辑
      }
    }, 800);
  }, [key]);
  const metaRef = useRef(meta);
  metaRef.current = meta;

  const setField = <K extends keyof Meta>(k: K, v: Meta[K]) => {
    setMeta((m) => ({ ...m, [k]: v }));
    touch();
  };

  // 打开时发现比服务器新的本地草稿 → 提示恢复
  useEffect(() => {
    const d = readDraft(key);
    const serverAt = post ? new Date(post.updatedAt).getTime() : 0;
    if (!d || d.at <= serverAt) return;
    toast("发现一份未保存的草稿", {
      description: new Date(d.at).toLocaleString("zh-CN"),
      duration: 15_000,
      action: {
        label: "恢复",
        onClick: () => {
          setMeta(d.meta);
          docRef.current = d.doc;
          setInitialDoc(d.doc);
          setEditorKey((k) => k + 1);
          setDirty(true);
        },
      },
      cancel: { label: "丢弃", onClick: () => localStorage.removeItem(key) },
    });
  }, [key, post]);

  const save = useCallback(
    async (status?: Meta["status"]) => {
      if (saving) return;
      const m = { ...metaRef.current, ...(status ? { status } : {}) };
      if (!m.title.trim()) {
        toast.error("先写个标题");
        return;
      }
      setSaving(true);
      try {
        const body = {
          title: m.title.trim(),
          slug: m.slug.trim(),
          excerpt: m.excerpt.trim(),
          coverUrl: m.coverUrl.trim() || undefined,
          tags: m.tags
            .split(/[,，]/)
            .map((t) => t.trim())
            .filter(Boolean),
          status: m.status,
          content: docRef.current,
        };
        const row = post
          ? await client.blog.update({ ...body, id: post.id })
          : await client.blog.create(body);
        localStorage.removeItem(key);
        setMeta((cur) => ({ ...cur, status: m.status, excerpt: row.excerpt ?? cur.excerpt }));
        setDirty(false);
        setSavedAt(new Date());
        void qc.invalidateQueries({ queryKey: ["admin-posts"] });
        qc.setQueryData(["admin-post", row.id], row);
        toast.success(
          status === "published" ? "已发布 ✿" : status === "draft" ? "已转为草稿" : "已保存 ✿",
        );
        if (!post) navigate(`/dash/blog/${row.id}`, { replace: true });
      } catch (e) {
        toast.error(orpcErrText(e, "保存失败", { slug: "Slug", title: "标题", content: "正文" }));
      } finally {
        setSaving(false);
      }
    },
    [saving, post, key, qc, navigate],
  );

  // ⌘S / Ctrl+S 保存
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  // 有未保存改动时：关闭标签页提示，站内跳转确认
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm("有未保存的改动，确定离开？（本地草稿会保留）")) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  async function pickCover() {
    const [file] = await pickImages(false);
    if (!file) return;
    setCoverBusy(true);
    try {
      setField("coverUrl", await uploadImage(file));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCoverBusy(false);
    }
  }

  const published = meta.status === "published";

  return (
    <div className="-mt-2">
      {/* 顶栏 */}
      <div className="sticky top-0 z-30 -mx-4 mb-4 flex items-center gap-2 border-b border-border bg-background/90 px-4 py-2 backdrop-blur">
        <Link
          prefetch="intent"
          to="/dash/blog"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> 文章
        </Link>
        <span
          className={cn(
            "ml-2 rounded-pill px-2 py-0.5 text-xs",
            published ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {published ? "已发布" : "草稿"}
        </span>
        <span className="text-xs text-muted-foreground">
          {saving
            ? "保存中…"
            : dirty
              ? "有未保存的改动"
              : savedAt
                ? `已保存 ${savedAt.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}`
                : ""}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {post && (
            <Button variant="ghost" size="sm" asChild>
              <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" /> 查看
              </a>
            </Button>
          )}
          <Button
            variant="soft"
            size="sm"
            disabled={saving || legacyOnly}
            onClick={() => void save()}
          >
            {saving ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            保存
          </Button>
          {published ? (
            <Button
              variant="ghost"
              size="sm"
              disabled={saving || legacyOnly}
              onClick={() => void save("draft")}
            >
              <Undo2 className="size-3.5" /> 转为草稿
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={saving || legacyOnly}
              onClick={() => void save("published")}
            >
              <Send className="size-3.5" /> 发布
            </Button>
          )}
        </div>
      </div>

      {legacyOnly && (
        <div className="mb-4 rounded-[var(--radius-md)] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          这篇还是旧的 Markdown
          格式，还没迁移到富文本。先在服务器上跑一次迁移脚本（apps/web/scripts/migrate-rich-content.ts）再编辑。
        </div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <input
            value={meta.title}
            onChange={(e) => setField("title", e.target.value)}
            placeholder="标题"
            className="mb-3 w-full bg-transparent text-3xl font-bold tracking-wide outline-none placeholder:text-muted-foreground/50"
          />
          {!legacyOnly && (
            <Suspense
              fallback={
                <div className="min-h-[60vh] animate-pulse rounded-[var(--radius-lg)] bg-muted/50" />
              }
            >
              <RichEditor
                key={editorKey}
                initialContent={initialDoc}
                onReady={(e) => {
                  editorRef.current = e;
                }}
                onChange={(doc) => {
                  docRef.current = doc;
                  touch();
                }}
              />
            </Suspense>
          )}
        </div>

        {/* 侧栏：文章属性 */}
        <aside className="w-full shrink-0 space-y-4 lg:sticky lg:top-16 lg:w-72">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Slug（网址）</span>
            <div className="flex items-center rounded-[var(--radius-md)] border border-border bg-background text-sm focus-within:border-primary">
              <span className="pl-3 text-muted-foreground">/blog/</span>
              <input
                value={meta.slug}
                onChange={(e) =>
                  setField("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
                }
                className="min-w-0 flex-1 bg-transparent py-2 pr-3 outline-none"
              />
            </div>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">摘要（留空自动从正文生成）</span>
            <textarea
              rows={3}
              value={meta.excerpt}
              onChange={(e) => setField("excerpt", e.target.value)}
              className={cn(input, "resize-y")}
            />
          </label>
          <div className="text-sm">
            <span className="mb-1 block text-muted-foreground">封面</span>
            {meta.coverUrl ? (
              <div className="group relative overflow-hidden rounded-[var(--radius-md)] border border-border">
                <img
                  src={thumb(meta.coverUrl, 640)}
                  alt=""
                  className="aspect-video w-full object-cover"
                />
                <button
                  type="button"
                  title="移除封面"
                  onClick={() => setField("coverUrl", "")}
                  className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={coverBusy}
                onClick={() => void pickCover()}
                className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-[var(--radius-md)] border border-dashed border-border text-muted-foreground transition hover:border-primary hover:text-primary"
              >
                {coverBusy ? (
                  <LoaderCircle className="size-5 animate-spin" />
                ) : (
                  <ImagePlus className="size-5" />
                )}
                {coverBusy ? "上传中…" : "上传封面"}
              </button>
            )}
            <input
              value={meta.coverUrl}
              onChange={(e) => setField("coverUrl", e.target.value)}
              placeholder="或粘贴图片地址"
              className={cn(input, "mt-2 text-xs")}
            />
          </div>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">标签（逗号分隔）</span>
            <input
              value={meta.tags}
              onChange={(e) => setField("tags", e.target.value)}
              className={input}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            ⌘S / Ctrl+S 保存 · 改动会自动存一份本地草稿
          </p>
        </aside>
      </div>
    </div>
  );
}
