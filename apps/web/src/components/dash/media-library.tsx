/**
 * 后台媒体库：管对象存储里的全部文件（图 / 视频 / 音频 / 附件）。
 * - 网格浏览 + 类型 / 用途 / 关键字筛选，图片走 ?w=320 缩略图
 * - 点开详情：大图预览、地址、引用来源（点进对应内容）
 * - 上传（CAS 去重）、替换（改掉全部引用后删旧文件）、删除（有引用默认拦住，force 才断链删）
 * - orphans 模式只列无人引用的文件，可全选批量清理
 */
import { Button, Card, CardBody, cn } from "@i/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Copy,
  FileAudio,
  FileQuestion,
  FileVideo,
  LoaderCircle,
  RefreshCw,
  Repeat,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { inputCls } from "@/components/dash/domain-admin";
import { client, orpc } from "@/lib/orpc/client";
import { STORED } from "@/lib/thumb";
import type { RouterOutputs } from "@/server/router";

type Item = RouterOutputs["media"]["list"]["items"][number];
type Filter = "all" | "image" | "video" | "audio" | "other";

const TYPE_LABEL: Record<Filter, string> = {
  all: "全部类型",
  image: "图片",
  video: "视频",
  audio: "音频",
  other: "其他",
};
const ICONS = { image: null, video: FileVideo, audio: FileAudio, other: FileQuestion };

const fmtBytes = (n: number) =>
  n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

export function MediaLibrary({ orphansOnly = false }: { orphansOnly?: boolean }) {
  const qc = useQueryClient();
  const [type, setType] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState<string | undefined>();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  const listInput = {
    type: type === "all" ? undefined : type,
    usage: orphansOnly ? ("orphan" as const) : ("all" as const),
    q: q.trim() || undefined,
  };
  const listQ = useQuery(orpc.media.list.queryOptions({ input: { ...listInput, cursor } }));
  const statsQ = useQuery(orpc.media.stats.queryOptions());
  const items = useMemo(() => listQ.data?.items ?? [], [listQ.data]);

  const invalidate = async () => {
    // list 的 input 里带游标，按 key 精确失效会漏掉别的页，整页失效省事
    await qc.invalidateQueries();
  };

  /** 筛选条件变了就从头翻，避免游标串页 */
  function resetTo(fn: () => void) {
    fn();
    setCursor(undefined);
    setSelected(new Set());
  }

  function toggle(key: string) {
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files];
    setUploading(list.length);
    let ok = 0;
    for (const file of list) {
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/gallery/upload", { method: "POST", body: fd });
        if (!res.ok) throw new Error();
        ok++;
      } catch {
        toast.error(`「${file.name}」上传失败`);
      }
      setUploading((n) => n - 1);
    }
    setUploading(0);
    if (ok) {
      toast.success(`已上传 ${ok} 个文件 ✿`);
      await invalidate();
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  /** 有新文件后把它替换到当前详情指向的文件上：先传、再改引用、最后删旧 */
  async function replaceWith(file: File | undefined) {
    if (!file || !open) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/gallery/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      const { imageUrl } = (await res.json()) as { imageUrl: string };
      const newKey = imageUrl.slice(STORED.length);
      const { updated } = await client.media.replace({ key: open.key, newKey });
      toast.success(`已替换，改了 ${updated} 处引用 ✿`);
      setOpen(null);
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "替换失败");
    } finally {
      setBusy(false);
      if (replaceRef.current) replaceRef.current.value = "";
    }
  }

  async function remove(keys: string[], force = false) {
    if (!keys.length || busy) return;
    setBusy(true);
    try {
      const { deleted, kept } = await client.media.remove({ keys, force });
      if (kept.length) {
        const ok = window.confirm(
          `${kept.length} 个文件仍被引用，强制删除会让这些位置的图裂开。继续？`,
        );
        if (ok) {
          const again = await client.media.remove({ keys: kept, force: true });
          toast.success(`已删除 ${deleted.length + again.deleted.length} 个文件`);
        } else if (deleted.length) {
          toast.success(`已删除 ${deleted.length} 个无引用文件`);
        }
      } else {
        toast.success(`已删除 ${deleted.length} 个文件`);
      }
      setSelected(new Set());
      setOpen(null);
      await invalidate();
    } catch {
      toast.error("删除失败");
    } finally {
      setBusy(false);
    }
  }

  const openUrl = open ? `${STORED}${open.key}` : "";
  const allVisibleSelected = items.length > 0 && items.every((i) => selected.has(i.key));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{orphansOnly ? "孤儿文件" : "媒体库"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {statsQ.data
              ? `${statsQ.data.files} 个文件 · ${fmtBytes(statsQ.data.bytes)} · 孤儿 ${statsQ.data.orphans} 个（${fmtBytes(statsQ.data.orphanBytes)}）`
              : "统计中…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => void invalidate()} disabled={listQ.isFetching}>
            <RefreshCw className={cn("size-4", listQ.isFetching && "animate-spin")} /> 刷新
          </Button>
          {!orphansOnly && (
            <>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => void upload(e.target.files)}
              />
              <Button
                variant="ghost"
                onClick={() => fileRef.current?.click()}
                disabled={uploading > 0}
              >
                {uploading > 0 ? (
                  <>
                    <LoaderCircle className="size-4 animate-spin" /> {uploading}
                  </>
                ) : (
                  <>
                    <Upload className="size-4" /> 上传
                  </>
                )}
              </Button>
            </>
          )}
          {selected.size > 0 && (
            <Button variant="ghost" onClick={() => void remove([...selected])} disabled={busy}>
              <Trash2 className="size-4" /> 删除选中（{selected.size}）
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <select
          value={type}
          onChange={(e) => resetTo(() => setType(e.target.value as Filter))}
          className={cn(inputCls, "w-auto")}
        >
          {(Object.keys(TYPE_LABEL) as Filter[]).map((k) => (
            <option key={k} value={k}>
              {TYPE_LABEL[k]}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => resetTo(() => setQ(e.target.value))}
          placeholder="搜索文件名…"
          className={cn(inputCls, "w-48")}
        />
        <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={() =>
              setSelected(allVisibleSelected ? new Set() : new Set(items.map((i) => i.key)))
            }
          />
          全选本页
        </label>
      </div>

      {listQ.isPending ? (
        <p className="mt-6 text-sm text-muted-foreground">加载中…</p>
      ) : items.length === 0 ? (
        <Card className="mt-6">
          <CardBody className="text-sm text-muted-foreground">
            {orphansOnly ? "没有孤儿文件 ✿" : "没有匹配的文件"}
          </CardBody>
        </Card>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => {
            const Icon = ICONS[item.type];
            const picked = selected.has(item.key);
            return (
              <li key={item.key}>
                <Card
                  className={cn(
                    "group relative overflow-hidden transition hover:shadow-md",
                    picked && "ring-2 ring-primary",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setOpen(item)}
                    className="block w-full cursor-pointer text-left"
                  >
                    <div className="grid aspect-4/3 place-items-center bg-muted">
                      {item.type === "image" ? (
                        <img
                          src={`${STORED}${item.key}?w=320`}
                          alt={item.key}
                          loading="lazy"
                          className="size-full object-contain"
                        />
                      ) : Icon ? (
                        <Icon className="size-8 text-muted-foreground" />
                      ) : null}
                    </div>
                    <CardBody className="space-y-0.5 py-2">
                      <div className="truncate font-mono text-[11px] text-muted-foreground">
                        {item.key}
                      </div>
                      <div className="text-xs">
                        {fmtBytes(item.size)}
                        {item.used ? (
                          <span className="ml-1.5 text-primary">· {item.refs.length} 处引用</span>
                        ) : (
                          <span className="ml-1.5 text-destructive">· 孤儿</span>
                        )}
                      </div>
                    </CardBody>
                  </button>
                  <input
                    type="checkbox"
                    checked={picked}
                    onChange={() => toggle(item.key)}
                    aria-label={`选择 ${item.key}`}
                    className="absolute right-2 top-2 size-4 accent-[var(--primary)]"
                  />
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {listQ.data?.next && (
        <div className="mt-4 text-center">
          <Button variant="ghost" onClick={() => setCursor(listQ.data?.next)}>
            加载更多
          </Button>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-60 grid place-items-center bg-black/60 p-4" role="dialog">
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto">
            <CardBody className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs">{open.key}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {fmtBytes(open.size)} · {TYPE_LABEL[open.type]}
                  </div>
                </div>
                <button type="button" onClick={() => setOpen(null)} aria-label="关闭">
                  <X className="size-4" />
                </button>
              </div>

              <div className="grid max-h-72 place-items-center overflow-hidden rounded-[var(--radius-md)] bg-muted">
                {open.type === "image" ? (
                  <img src={openUrl} alt={open.key} className="max-h-72 object-contain" />
                ) : open.type === "video" ? (
                  // biome-ignore lint/a11y/useMediaCaption: 上传的视频没有字幕轨
                  <video src={openUrl} controls className="max-h-72 w-full" />
                ) : open.type === "audio" ? (
                  // biome-ignore lint/a11y/useMediaCaption: 上传的音频没有字幕轨
                  <audio src={openUrl} controls className="w-full px-4" />
                ) : (
                  <a
                    href={openUrl}
                    className="p-6 text-sm underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    下载文件
                  </a>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    void navigator.clipboard.writeText(`${window.location.origin}${openUrl}`);
                    toast.success("地址已复制");
                  }}
                >
                  <Copy className="size-4" /> 复制地址
                </Button>
                <input
                  ref={replaceRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => void replaceWith(e.target.files?.[0])}
                />
                <Button variant="ghost" onClick={() => replaceRef.current?.click()} disabled={busy}>
                  <Repeat className="size-4" /> 替换
                </Button>
                <Button variant="ghost" onClick={() => void remove([open.key])} disabled={busy}>
                  <Trash2 className="size-4" /> 删除
                </Button>
              </div>

              <div>
                <h2 className="text-sm font-semibold">引用来源</h2>
                {open.refs.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">无人引用</p>
                ) : (
                  <ul className="mt-1.5 space-y-1 text-xs">
                    {open.refs.map((r) => (
                      <li key={`${r.table}:${r.id}`} className="flex items-center gap-2">
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{r.table}</span>
                        <span className="min-w-0 flex-1 truncate">{r.label}</span>
                        {r.href && (
                          <a href={r.href} className="text-primary underline">
                            打开
                          </a>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}
