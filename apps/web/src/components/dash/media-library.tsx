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
  FileDown,
  FileQuestion,
  FileVideo,
  LoaderCircle,
  RefreshCw,
  Repeat,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { toast } from "sonner";
import { ChartFrame, ChartTip, chartInk } from "@/components/dash/chart";
import { inputCls } from "@/components/dash/domain-admin";
import { client, orpc } from "@/lib/orpc/client";
import { STORED } from "@/lib/thumb";
import type { RouterOutputs } from "@/server/router";

type Item = RouterOutputs["media"]["list"]["items"][number];
type Filter = "all" | "image" | "video" | "audio" | "other";
type Sort = "newest" | "oldest" | "largest" | "smallest" | "refs" | "key";

const TYPE_LABEL: Record<Filter, string> = {
  all: "全部类型",
  image: "图片",
  video: "视频",
  audio: "音频",
  other: "其他",
};
/** 饼图用的类型配色与文案（顺序固定，颜色跟主题走） */
const TYPE_PIE: { key: Exclude<Filter, "all">; label: string; color: string }[] = [
  { key: "image", label: "图片", color: "var(--primary)" },
  { key: "video", label: "视频", color: "var(--ring)" },
  { key: "audio", label: "音频", color: "var(--accent-foreground)" },
  { key: "other", label: "其他", color: "var(--muted-foreground)" },
];

const SORT_LABEL: Record<Sort, string> = {
  newest: "最近上传",
  oldest: "最早上传",
  largest: "体积从大到小",
  smallest: "体积从小到大",
  refs: "引用最多",
  key: "按 key",
};
const SIZE_LABEL: Record<string, string> = {
  "0": "不限体积",
  "1000000": "≥ 1 MB",
  "5000000": "≥ 5 MB",
  "20000000": "≥ 20 MB",
};
const ICONS = { image: null, video: FileVideo, audio: FileAudio, other: FileQuestion };

const fmtBytes = (n: number) =>
  n >= 1 << 20 ? `${(n / (1 << 20)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

const fmtTime = (iso: string) => {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "时间未知";
  return new Date(t).toLocaleString("zh-CN", { hour12: false });
};

export function MediaLibrary({ orphansOnly = false }: { orphansOnly?: boolean }) {
  const qc = useQueryClient();
  const [type, setType] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("newest");
  const [minBytes, setMinBytes] = useState("0");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statsOpen, setStatsOpen] = useState(false);
  const [open, setOpen] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  const listInput = {
    type: type === "all" ? undefined : type,
    usage: orphansOnly ? ("orphan" as const) : ("all" as const),
    sort,
    q: q.trim() || undefined,
    minBytes: Number(minBytes) || undefined,
  };
  const listQ = useQuery(orpc.media.list.queryOptions({ input: { ...listInput, offset } }));
  const statsQ = useQuery(orpc.media.stats.queryOptions());
  const items = useMemo(() => listQ.data?.items ?? [], [listQ.data]);

  const invalidate = async () => {
    // list 的 input 里带游标，按 key 精确失效会漏掉别的页，整页失效省事
    await qc.invalidateQueries();
  };

  /** 筛选条件变了就从头翻，避免页码串位 */
  function resetTo(fn: () => void) {
    fn();
    setOffset(0);
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
      if (file.size > 50 << 20) {
        toast.error(`「${file.name}」超过 50 MB，已跳过`);
        setUploading((n) => n - 1);
        continue;
      }
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/gallery/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const detail = await res
            .json()
            .then((b: { error?: string }) => b.error)
            .catch(() => undefined);
          throw new Error(detail ?? `HTTP ${res.status}`);
        }
        ok++;
      } catch (e) {
        toast.error(`「${file.name}」上传失败：${e instanceof Error ? e.message : "未知错误"}`);
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
  const openIndex = open ? items.findIndex((i) => i.key === open.key) : -1;
  const step = (delta: number) => {
    const next = items[openIndex + delta];
    if (next) setOpen(next);
  };

  /** 详情开着时的键盘：Esc 关、←/→ 前后张、Delete 删当前 */
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "Delete" && !busy) void remove([open!.key]);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function copySelected() {
    const text = [...selected].map((k) => `${window.location.origin}${STORED}${k}`).join("\n");
    void navigator.clipboard.writeText(text);
    toast.success(`已复制 ${selected.size} 个地址`);
  }

  function exportSelected() {
    const text = items
      .filter((i) => selected.has(i.key))
      .map((i) => `${i.key}\t${i.size}\t${i.lastModified}\t${i.used ? i.refs.length : 0}`)
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([`key\tsize\tlastModified\trefs\n${text}\n`]));
    a.download = "media-selected.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <section
      aria-label="媒体库（可拖入文件上传）"
      onDragOver={(e) => {
        if (orphansOnly) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (orphansOnly) return;
        e.preventDefault();
        setDragging(false);
        void upload(e.dataTransfer.files);
      }}
      className={cn(
        "pb-24 sm:pb-0",
        dragging && "rounded-md outline-2 outline-dashed outline-primary",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">{orphansOnly ? "孤儿文件" : "媒体库"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {statsQ.data
              ? `${statsQ.data.files} 个文件 · ${fmtBytes(statsQ.data.bytes)} · 孤儿 ${statsQ.data.orphans} 个（${fmtBytes(statsQ.data.orphanBytes)}）`
              : "统计中…"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            onClick={() => void invalidate()}
            disabled={listQ.isFetching}
            aria-label="刷新"
          >
            <RefreshCw className={cn("size-4", listQ.isFetching && "animate-spin")} />
            <span className="hidden sm:inline">刷新</span>
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
        </div>
      </div>

      {statsQ.data && statsQ.data.largest.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setStatsOpen((v) => !v)}
            aria-expanded={statsOpen}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline sm:hidden"
          >
            {statsOpen ? "收起占用统计" : "展开占用统计"}
          </button>
          <div
            className={cn(
              "mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:mt-0 sm:flex",
              !statsOpen && "hidden",
            )}
          >
            <span>最大的文件：</span>
            {statsQ.data.largest.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => resetTo(() => setQ(f.key))}
                className="rounded border border-border px-1.5 py-0.5 font-mono hover:bg-muted"
              >
                {fmtBytes(f.size)} · {f.key.slice(0, 8)}
              </button>
            ))}
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border border-border p-2">
              <div className="mb-1 text-xs font-medium">类型分布</div>
              <ChartFrame className="h-32" label="媒体类型分布饼图">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip content={<ChartTip unit=" 个" />} />
                    <Pie
                      data={TYPE_PIE.map((t) => ({ ...t, n: statsQ.data.byType[t.key] })).filter(
                        (t) => t.n > 0,
                      )}
                      dataKey="n"
                      nameKey="label"
                      innerRadius="52%"
                      outerRadius="82%"
                      paddingAngle={2}
                      stroke="var(--card)"
                    >
                      {TYPE_PIE.map((t) => (
                        <Cell key={t.key} fill={t.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </ChartFrame>
              <div className="mt-1 flex flex-wrap gap-x-2 text-caption text-muted-foreground">
                {TYPE_PIE.map((t) => (
                  <span key={t.key} className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full" style={{ background: t.color }} />
                    {t.label} {statsQ.data.byType[t.key]}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-border p-2">
              <div className="mb-1 text-xs font-medium">体积分布</div>
              <ChartFrame className="h-32" label="媒体体积分档柱状图">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={statsQ.data.buckets}
                    margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
                  >
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: chartInk.muted }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip content={<ChartTip unit=" 个" />} cursor={{ fill: chartInk.soft }} />
                    <Bar dataKey="n" name="文件" radius={[3, 3, 0, 0]} fill={chartInk.primary} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartFrame>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
        <select
          value={type}
          onChange={(e) => resetTo(() => setType(e.target.value as Filter))}
          className={cn(inputCls, "w-full")}
        >
          {(Object.keys(TYPE_LABEL) as Filter[]).map((k) => (
            <option key={k} value={k}>
              {TYPE_LABEL[k]}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => resetTo(() => setSort(e.target.value as Sort))}
          className={cn(inputCls, "w-full")}
          aria-label="排序"
        >
          {(Object.keys(SORT_LABEL) as Sort[]).map((k) => (
            <option key={k} value={k}>
              {SORT_LABEL[k]}
            </option>
          ))}
        </select>
        <select
          value={minBytes}
          onChange={(e) => resetTo(() => setMinBytes(e.target.value))}
          className={cn(inputCls, "w-full")}
          aria-label="体积筛选"
        >
          {Object.entries(SIZE_LABEL).map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => resetTo(() => setQ(e.target.value))}
          placeholder="搜索文件名或出处…"
          className={cn(inputCls, "col-span-2 w-full sm:w-48")}
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
        {q.trim() && (
          <span className="text-xs text-muted-foreground">
            命中 {listQ.data?.total ?? 0} 个
            <button
              type="button"
              className="ml-1 underline"
              onClick={() => resetTo(() => setQ(""))}
            >
              清除
            </button>
          </span>
        )}
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
                      <div className="truncate font-mono text-caption text-muted-foreground">
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
                    className="absolute right-2 top-2 size-5 accent-[var(--primary)] sm:size-4"
                  />
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {listQ.data?.next !== undefined && (
        <div className="mt-4 text-center">
          <Button variant="ghost" onClick={() => setOffset(listQ.data!.next!)}>
            加载更多（已看 {items.length} / {listQ.data?.total}）
          </Button>
        </div>
      )}

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-1 [&_button]:min-h-10 border-t border-border bg-background/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mt-4 sm:flex-wrap sm:rounded-md sm:border sm:bg-muted/40 sm:p-2 sm:pb-2">
          <span className="mr-1 shrink-0 text-xs text-muted-foreground">已选 {selected.size}</span>
          <Button variant="ghost" onClick={copySelected} aria-label="复制地址">
            <Copy className="size-4" />
            <span className="hidden sm:inline">复制地址</span>
          </Button>
          <Button variant="ghost" onClick={exportSelected} aria-label="导出清单">
            <FileDown className="size-4" />
            <span className="hidden sm:inline">导出清单</span>
          </Button>
          <Button
            variant="ghost"
            className="ml-auto sm:ml-0"
            onClick={() => void remove([...selected])}
            disabled={busy}
            aria-label="删除选中"
          >
            <Trash2 className="size-4" />
            <span className="hidden sm:inline">删除选中</span>
          </Button>
          <Button
            variant="ghost"
            onClick={() => setSelected(new Set())}
            aria-label="清空选择"
            className="text-muted-foreground"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-60 flex flex-col bg-black/60 sm:grid sm:place-items-center sm:p-4"
          role="dialog"
        >
          <Card className="flex h-full w-full flex-col overflow-y-auto rounded-none sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-lg">
            <CardBody className="space-y-3 pt-[max(1rem,env(safe-area-inset-top))] sm:pt-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs">{open.key}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {fmtBytes(open.size)} · {TYPE_LABEL[open.type]} · 上传于{" "}
                    {fmtTime(open.lastModified)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5 text-xs text-muted-foreground">
                  {openIndex >= 0 && (
                    <span className="mr-1">
                      {openIndex + 1} / {items.length}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => step(-1)}
                    disabled={openIndex <= 0}
                    aria-label="上一张"
                    className="grid size-9 place-items-center rounded-md text-base hover:bg-muted disabled:opacity-30 sm:size-8"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => step(1)}
                    disabled={openIndex < 0 || openIndex >= items.length - 1}
                    aria-label="下一张"
                    className="grid size-9 place-items-center rounded-md text-base hover:bg-muted disabled:opacity-30 sm:size-8"
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(null)}
                    aria-label="关闭"
                    className="grid size-9 place-items-center rounded-md hover:bg-muted sm:size-8"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              </div>

              <div className="grid max-h-[45vh] place-items-center overflow-hidden rounded-md bg-muted sm:max-h-72">
                {open.type === "image" ? (
                  <img
                    src={openUrl}
                    alt={open.key}
                    className="max-h-[45vh] object-contain sm:max-h-72"
                  />
                ) : open.type === "video" ? (
                  // biome-ignore lint/a11y/useMediaCaption: 上传的视频没有字幕轨
                  <video src={openUrl} controls className="max-h-[45vh] w-full sm:max-h-72" />
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
                        <span className="rounded bg-muted px-1.5 py-0.5">{r.source}</span>
                        <span className="min-w-0 flex-1 truncate">{r.label}</span>
                        {r.href && (
                          <a
                            href={r.href}
                            className="text-primary underline"
                            target="_blank"
                            rel="noreferrer"
                          >
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
    </section>
  );
}
