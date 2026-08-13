"use client";

/**
 * 相册照片专属管理页（替代通用 CRUD 表格）：
 * - 缩略图网格 + 图集筛选（全部 / 各图集 / 未分类）
 * - 点图多选 → 批量移动到图集 / 批量删除
 * - 多文件批量上传到指定图集（走 /api/gallery/upload → gallery.create）
 * - 悬停铅笔进入单张编辑（复用通用 Field + 图集下拉）
 */
import { Button, Card, CardBody, cn } from "@i/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Pencil, Plus, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { emptyForm, Field, inputCls, rowToForm, toBody } from "@/components/dash/domain-admin";
import { ADMIN_FIELDS } from "@/lib/admin-fields";
import { useTRPC, useTRPCClient } from "@/lib/trpc/client";
import type { AppRouter } from "@/server/root";

type Photo = inferRouterOutputs<AppRouter>["gallery"]["list"][number];
type FormState = Record<string, unknown>;

/** 筛选值："all" | "none"(未分类) | albumId */
type Filter = "all" | "none" | (string & {});

// 通用编辑器字段（图集下拉在下方单独渲染）
const PHOTO_FIELDS = ADMIN_FIELDS.gallery!.fields;

export function PhotosAdmin() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const qc = useQueryClient();

  const photosQ = useQuery(trpc.gallery.list.queryOptions());
  // /dash/albums 通用编辑器用自己的 ["admin-list"] 缓存键，不会失效这里的
  // 类型化键——进页强制刷新，避免刚建/删的图集在下拉里缺席
  const albumsQ = useQuery({
    ...trpc.albums.list.queryOptions(),
    staleTime: 0,
    refetchOnMount: "always",
  });
  const albums = albumsQ.data ?? [];
  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: trpc.gallery.list.queryKey() }),
      qc.invalidateQueries({ queryKey: trpc.albums.list.queryKey() }),
    ]);

  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Photo | "new" | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [formAlbumId, setFormAlbumId] = useState("");
  const [saving, setSaving] = useState(false);
  const [moveTarget, setMoveTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const photos = useMemo(() => {
    const all = photosQ.data ?? [];
    if (filter === "all") return all;
    if (filter === "none") return all.filter((p) => !p.albumId);
    return all.filter((p) => p.albumId === filter);
  }, [photosQ.data, filter]);

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openEdit(p: Photo | "new") {
    setForm(p === "new" ? emptyForm(PHOTO_FIELDS) : rowToForm(PHOTO_FIELDS, p));
    setFormAlbumId(
      p === "new" ? (filter !== "all" && filter !== "none" ? filter : "") : (p.albumId ?? ""),
    );
    setEditing(p);
  }

  async function save() {
    if (saving || !editing) return;
    const body = toBody(PHOTO_FIELDS, form);
    if (typeof body.imageUrl !== "string" || !body.imageUrl.trim()) {
      toast.error("「图片链接」不能为空");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...body, albumId: formAlbumId || null };
      if (editing === "new") await client.gallery.create.mutate(payload as never);
      else await client.gallery.update.mutate({ ...payload, id: editing.id } as never);
      toast.success("已保存 ✿");
      setEditing(null);
      // 编辑可能把照片改到当前筛选之外：清掉选择，避免批量操作命中不可见照片
      setSelected(new Set());
      await invalidate();
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function bulkMove() {
    if (busy || selected.size === 0) return;
    setBusy(true);
    try {
      await client.gallery.movePhotos.mutate({
        ids: [...selected],
        albumId: moveTarget || null,
      });
      toast.success(`已移动 ${selected.size} 张 ✿`);
      setSelected(new Set());
      await invalidate();
    } catch {
      toast.error("移动失败");
    } finally {
      setBusy(false);
    }
  }

  async function bulkDelete() {
    if (busy || selected.size === 0) return;
    if (!window.confirm(`确定删除选中的 ${selected.size} 张照片？`)) return;
    setBusy(true);
    try {
      await client.gallery.deletePhotos.mutate({ ids: [...selected] });
      toast.success("已删除");
      setSelected(new Set());
      await invalidate();
    } catch {
      toast.error("删除失败");
    } finally {
      setBusy(false);
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const albumId = filter !== "all" && filter !== "none" ? filter : null;
    const list = [...files];
    setUploading({ done: 0, total: list.length });
    let ok = 0;
    for (const file of list) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/gallery/upload", {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        if (!res.ok) throw new Error();
        const { imageUrl } = (await res.json()) as { imageUrl: string };
        try {
          await client.gallery.create.mutate({ imageUrl, albumId });
        } catch (e) {
          // 建档失败则删掉刚传的对象，避免存储孤儿
          const key = imageUrl.split("/").pop();
          if (key)
            void fetch(`/api/gallery/upload?key=${encodeURIComponent(key)}`, {
              method: "DELETE",
              credentials: "include",
            }).catch(() => {});
          throw e;
        }
        ok++;
      } catch {
        toast.error(`「${file.name}」上传失败`);
      }
      setUploading((cur) => (cur ? { ...cur, done: cur.done + 1 } : cur));
    }
    setUploading(null);
    if (ok > 0) {
      toast.success(`上传完成：${ok}/${list.length} 张 ✿`);
      await invalidate();
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  const uploadHint =
    filter !== "all" && filter !== "none"
      ? `上传到「${albums.find((a) => a.id === filter)?.name ?? "…"}」`
      : "上传（未分类）";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">相册</h1>
        {editing == null && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setSelected(new Set());
              }}
              className={cn(inputCls, "w-auto")}
            >
              <option value="all">全部照片</option>
              {albums.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
              <option value="none">未分类</option>
            </select>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => void uploadFiles(e.target.files)}
            />
            <Button
              variant="ghost"
              onClick={() => fileRef.current?.click()}
              disabled={uploading != null}
            >
              {uploading ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> {uploading.done}/{uploading.total}
                </>
              ) : (
                <>
                  <Upload className="size-4" /> {uploadHint}
                </>
              )}
            </Button>
            <Button onClick={() => openEdit("new")}>
              <Plus className="size-4" /> 新建
            </Button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {editing != null ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <Card className="mt-4">
              <CardBody className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {PHOTO_FIELDS.map((f) => (
                    <Field
                      key={f.name}
                      field={f}
                      value={form[f.name]}
                      onChange={(v) => setForm((p) => ({ ...p, [f.name]: v }))}
                    />
                  ))}
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-muted-foreground">
                      图集
                    </span>
                    <select
                      value={formAlbumId}
                      onChange={(e) => setFormAlbumId(e.target.value)}
                      className={inputCls}
                    >
                      <option value="">未分类</option>
                      {albums.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => void save()} disabled={saving}>
                    {saving && <Loader2 className="size-4 animate-spin" />}
                    {saving ? "保存中…" : editing === "new" ? "创建" : "保存修改"}
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
                    取消
                  </Button>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {selected.size > 0 && (
              <Card className="mt-4">
                <CardBody className="flex flex-wrap items-center gap-2 py-3 text-sm">
                  <span className="font-medium">已选 {selected.size} 张</span>
                  <select
                    value={moveTarget}
                    onChange={(e) => setMoveTarget(e.target.value)}
                    className={cn(inputCls, "w-auto")}
                  >
                    <option value="">未分类</option>
                    {albums.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <Button size="sm" onClick={() => void bulkMove()} disabled={busy}>
                    移动到图集
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void bulkDelete()}
                    disabled={busy}
                  >
                    删除
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                    取消选择
                  </Button>
                </CardBody>
              </Card>
            )}

            <Card className="mt-4">
              {photosQ.isLoading ? (
                <CardBody className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
                  {[...Array(12).keys()].map((i) => (
                    <div
                      key={i}
                      className="aspect-square animate-pulse rounded-[var(--radius-md)] bg-soft"
                    />
                  ))}
                </CardBody>
              ) : photosQ.isError ? (
                <CardBody className="text-sm text-muted-foreground">加载失败，刷新重试 ✿</CardBody>
              ) : photos.length === 0 ? (
                <CardBody className="text-sm text-muted-foreground">
                  这里还没有照片，右上「上传」或「新建」添加 ✿
                </CardBody>
              ) : (
                <CardBody className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
                  {photos.map((p) => {
                    const on = selected.has(p.id);
                    return (
                      <div
                        key={p.id}
                        className={cn(
                          "group relative aspect-square overflow-hidden rounded-[var(--radius-md)] bg-soft",
                          on && "ring-2 ring-primary",
                        )}
                      >
                        <button
                          type="button"
                          className="absolute inset-0"
                          aria-label={on ? "取消选择" : "选择"}
                          onClick={() => toggle(p.id)}
                        >
                          {/* biome-ignore lint/performance/noImgElement: 管理端缩略图，沿用原生 img */}
                          <img
                            src={p.thumbUrl || p.imageUrl}
                            alt={p.title || "照片"}
                            loading="lazy"
                            className={cn(
                              "h-full w-full object-cover transition",
                              on ? "scale-95 rounded-[var(--radius-md)]" : "group-hover:scale-105",
                            )}
                          />
                        </button>
                        <span
                          className={cn(
                            "pointer-events-none absolute left-1.5 top-1.5 grid size-5 place-items-center rounded-full border text-white transition",
                            on
                              ? "border-primary bg-primary"
                              : "border-white/70 bg-black/30 opacity-0 group-hover:opacity-100",
                          )}
                        >
                          {on && <Check className="size-3.5" />}
                        </span>
                        {filter === "all" && p.album && (
                          <span className="pointer-events-none absolute bottom-1 left-1.5 max-w-[80%] truncate rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                            {p.album.name}
                          </span>
                        )}
                        <button
                          type="button"
                          aria-label="编辑"
                          className="absolute bottom-1 right-1 grid size-6 place-items-center rounded-full bg-black/50 text-white opacity-0 transition hover:bg-black/70 group-hover:opacity-100"
                          onClick={() => openEdit(p)}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </CardBody>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
