import { Button } from "@i/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink, LoaderCircle, Save } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Link, useBlocker } from "react-router";
import { toast } from "sonner";
import { ContentExportMenu } from "@/components/dash/content-export";
import type { RichDoc } from "@/lib/content/types";
import { emptyDoc } from "@/lib/content/types";
import { client } from "@/lib/orpc/client";
import { orpcErrText } from "@/lib/orpc/errors";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/page-edit";

const RichEditor = lazy(() =>
  import("@/components/editor/rich-editor").then((m) => ({ default: m.RichEditor })),
);

export const meta: Route.MetaFunction = (args) =>
  seo(args, { title: "编辑整页 · 后台", noindex: true });

export default function PageEditPage({ params }: Route.ComponentProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-page", params.id],
    queryFn: () => client.page.get({ id: params.id }),
    refetchOnWindowFocus: false,
  });
  if (isLoading)
    return <div className="h-[70vh] animate-pulse rounded-[var(--radius-lg)] bg-muted/50" />;
  if (!data) return <div className="text-sm text-muted-foreground">页面不存在</div>;
  return <PageEditor key={data.id} page={data} />;
}

type Page = NonNullable<Awaited<ReturnType<typeof client.page.get>>>;

function PageEditor({ page }: { page: Page }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(page.title);
  const docRef = useRef<RichDoc>((page.content as RichDoc | null) ?? emptyDoc());
  const [dirty, setDirtyState] = useState(false);
  // 离开拦截读 ref：保存后紧接着 navigate 时，state 还没更新，读 state 会把这次跳转拦下来
  const dirtyRef = useRef(false);
  const setDirty = useCallback((v: boolean) => {
    dirtyRef.current = v;
    setDirtyState(v);
  }, []);
  const [saving, setSaving] = useState(false);
  const legacyOnly = !page.content && !!page.contentMd;

  const save = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      await client.page.update({
        id: page.id,
        title: title.trim() || page.title,
        content: docRef.current,
      });
      setDirty(false);
      void qc.invalidateQueries({ queryKey: ["admin-pages"] });
      toast.success("已保存 ✿");
    } catch (e) {
      toast.error(orpcErrText(e, "保存失败"));
    } finally {
      setSaving(false);
    }
  }, [saving, page, title, qc, setDirty]);

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

  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [dirty]);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirtyRef.current && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (window.confirm("有未保存的改动，确定离开？")) blocker.proceed();
    else blocker.reset();
  }, [blocker]);

  return (
    <div className="-mt-2">
      <div className="sticky top-0 z-30 -mx-4 mb-4 flex flex-wrap items-center gap-2 border-b border-border bg-background/90 px-4 py-2 backdrop-blur">
        <Link
          prefetch="intent"
          to="/dash/pages"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> 整页
        </Link>
        <span className="text-xs text-muted-foreground">
          {saving ? "保存中…" : dirty ? "有未保存的改动" : ""}
        </span>
        <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
          <ContentExportMenu kind="page" id={page.id} disabled={dirty || saving} />
          <Button variant="ghost" size="sm" asChild>
            <a href={`/${page.id}`} target="_blank" rel="noreferrer">
              <ExternalLink className="size-3.5" /> 查看
            </a>
          </Button>
          <Button size="sm" disabled={saving || legacyOnly} onClick={() => void save()}>
            {saving ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            保存
          </Button>
        </div>
      </div>
      {legacyOnly && (
        <div className="mb-4 rounded-[var(--radius-md)] border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          这一页还是旧的 Markdown 格式，先跑一次迁移脚本再编辑。
        </div>
      )}
      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setDirty(true);
        }}
        className="mb-3 w-full bg-transparent text-3xl font-bold tracking-wide outline-none"
      />
      {!legacyOnly && (
        <Suspense
          fallback={
            <div className="min-h-[60vh] animate-pulse rounded-[var(--radius-lg)] bg-muted/50" />
          }
        >
          <RichEditor
            initialContent={docRef.current}
            onChange={(doc) => {
              docRef.current = doc;
              setDirty(true);
            }}
          />
        </Suspense>
      )}
    </div>
  );
}
