/**
 * 自定义块在编辑器里的样子（NodeView）。容器类（提示框、标签页、时间轴）用 NodeViewContent
 * 保留可编辑的富文本内容；原子块（图集、视频、音乐、嵌入、按钮）用表单编辑属性。
 * 控件区都标 contentEditable={false}，避免光标跑进去。
 */
import { cn } from "@i/ui";
import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  LoaderCircle,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { faIcon } from "@/components/content/blocks/fa-icon";
import { toEmbedSrc } from "@/lib/content/embed";
import type { GalleryImage } from "@/lib/content/nodes";
import { thumb } from "@/lib/thumb";
import { pickImages, uploadImage } from "./upload";

const input =
  "h-7 rounded-[var(--radius-sm)] border border-border bg-background px-2 text-xs outline-none focus:border-primary";
const iconBtn =
  "inline-flex size-6 items-center justify-center rounded-[var(--radius-sm)] text-muted-foreground transition hover:bg-muted hover:text-foreground";

export const COLORS: { value: string; label: string; css: string }[] = [
  { value: "", label: "主题色", css: "var(--primary)" },
  { value: "blue", label: "蓝", css: "#3b82f6" },
  { value: "cyan", label: "青", css: "#06b6d4" },
  { value: "green", label: "绿", css: "#22c55e" },
  { value: "yellow", label: "黄", css: "#eab308" },
  { value: "orange", label: "橙", css: "#f97316" },
  { value: "red", label: "红", css: "#ef4444" },
];
const colorCss = (v: unknown) => COLORS.find((c) => c.value === (v ?? ""))?.css ?? "var(--primary)";

const ICONS: { value: string; label: string }[] = [
  { value: "", label: "默认" },
  { value: "fas fa-info-circle", label: "信息" },
  { value: "fas fa-lightbulb", label: "提示" },
  { value: "fas fa-exclamation-triangle", label: "警告" },
  { value: "fas fa-check-circle", label: "完成" },
  { value: "fas fa-times-circle", label: "错误" },
  { value: "fas fa-bell", label: "通知" },
  { value: "fas fa-bullhorn", label: "公告" },
  { value: "fas fa-star", label: "星标" },
  { value: "fas fa-heart", label: "喜欢" },
  { value: "fas fa-fire", label: "热门" },
  { value: "none", label: "无图标" },
];

/** 块上方的控件条 */
function Bar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      contentEditable={false}
      className={cn(
        "flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground select-none",
        className,
      )}
    >
      {children}
    </div>
  );
}

function ColorDots({ value, onChange }: { value: unknown; onChange: (v: string | null) => void }) {
  return (
    <span className="inline-flex items-center gap-1">
      {COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          title={c.label}
          onClick={() => onChange(c.value || null)}
          className={cn(
            "size-4 rounded-full border-2 transition",
            (value ?? "") === c.value ? "border-foreground" : "border-transparent",
          )}
          style={{ background: c.css }}
        />
      ))}
    </span>
  );
}

// ---------------- 提示框 ----------------

export function CalloutView({ node, updateAttributes, selected }: NodeViewProps) {
  const accent = colorCss(node.attrs.color);
  const Icon = faIcon(node.attrs.icon ?? undefined);
  return (
    <NodeViewWrapper
      className={cn(
        "my-4 rounded-[var(--radius-md)] px-4 py-3",
        selected && "ring-2 ring-primary/40",
      )}
      style={{
        borderLeft: `3px solid ${accent}`,
        background: `color-mix(in srgb, ${accent} 10%, transparent)`,
      }}
    >
      <Bar className="mb-2">
        <span>提示框</span>
        <ColorDots value={node.attrs.color} onChange={(color) => updateAttributes({ color })} />
        <select
          className={input}
          value={node.attrs.icon ?? ""}
          onChange={(e) => updateAttributes({ icon: e.target.value || null })}
        >
          {ICONS.map((i) => (
            <option key={i.value} value={i.value}>
              {i.label}
            </option>
          ))}
        </select>
      </Bar>
      <div className="flex items-start gap-3">
        {Icon && (
          <Icon aria-hidden className="mt-[0.3em] size-4 shrink-0" style={{ color: accent }} />
        )}
        <NodeViewContent className="min-w-0 flex-1 [&>:first-child]:mt-0 [&>:last-child]:mb-0" />
      </div>
    </NodeViewWrapper>
  );
}

// ---------------- 标签页 ----------------

export function TabsView({ node, editor, getPos }: NodeViewProps) {
  function addTab() {
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor
      .chain()
      .focus()
      .insertContentAt(pos + node.nodeSize - 1, {
        type: "tab",
        attrs: { label: `标签 ${node.childCount + 1}` },
        content: [{ type: "paragraph" }],
      })
      .run();
  }
  return (
    <NodeViewWrapper className="my-5 rounded-[var(--radius-md)] border border-dashed border-border p-3">
      <Bar className="mb-2">
        <span>标签页 · {node.childCount} 个</span>
        <button type="button" className={cn(iconBtn, "w-auto gap-1 px-1.5")} onClick={addTab}>
          <Plus className="size-3.5" /> 添加标签
        </button>
      </Bar>
      <NodeViewContent className="space-y-3" />
    </NodeViewWrapper>
  );
}

export function TabView({ node, updateAttributes, deleteNode, editor, getPos }: NodeViewProps) {
  const pos = getPos();
  const siblings = typeof pos === "number" ? editor.state.doc.resolve(pos).parent.childCount : 1;
  return (
    <NodeViewWrapper className="rounded-[var(--radius-md)] bg-card p-3">
      <Bar className="mb-2">
        <input
          className={cn(input, "w-40 font-medium text-foreground")}
          value={node.attrs.label ?? ""}
          placeholder="标签名"
          onChange={(e) => updateAttributes({ label: e.target.value })}
        />
        {siblings > 1 && (
          <button type="button" title="删除这个标签" className={iconBtn} onClick={deleteNode}>
            <Trash2 className="size-3.5" />
          </button>
        )}
      </Bar>
      <NodeViewContent className="[&>:first-child]:mt-0 [&>:last-child]:mb-0" />
    </NodeViewWrapper>
  );
}

// ---------------- 时间轴 ----------------

export function TimelineView({ node, updateAttributes, editor, getPos }: NodeViewProps) {
  function addItem() {
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor
      .chain()
      .focus()
      .insertContentAt(pos + node.nodeSize - 1, {
        type: "timelineItem",
        attrs: { label: "" },
        content: [{ type: "paragraph" }],
      })
      .run();
  }
  return (
    <NodeViewWrapper className="my-5">
      <Bar className="mb-2">
        <span>时间轴</span>
        <input
          className={cn(input, "w-48")}
          value={node.attrs.title ?? ""}
          placeholder="标题（可选）"
          onChange={(e) => updateAttributes({ title: e.target.value || null })}
        />
        <button type="button" className={cn(iconBtn, "w-auto gap-1 px-1.5")} onClick={addItem}>
          <Plus className="size-3.5" /> 添加节点
        </button>
      </Bar>
      <NodeViewContent className="ml-1.5 border-l border-border" />
    </NodeViewWrapper>
  );
}

export function TimelineItemView({
  node,
  updateAttributes,
  deleteNode,
  editor,
  getPos,
}: NodeViewProps) {
  const pos = getPos();
  const siblings = typeof pos === "number" ? editor.state.doc.resolve(pos).parent.childCount : 1;
  return (
    <NodeViewWrapper className="relative pb-4 pl-6">
      <span
        contentEditable={false}
        className="absolute top-2 left-0 size-3 -translate-x-1/2 rounded-full border-2 border-background bg-primary"
      />
      <Bar className="mb-1">
        <input
          className={cn(input, "w-40 font-semibold text-primary")}
          value={node.attrs.label ?? ""}
          placeholder="时间 / 阶段"
          onChange={(e) => updateAttributes({ label: e.target.value })}
        />
        {siblings > 1 && (
          <button type="button" title="删除这个节点" className={iconBtn} onClick={deleteNode}>
            <Trash2 className="size-3.5" />
          </button>
        )}
      </Bar>
      <NodeViewContent className="[&>:first-child]:mt-0 [&>:last-child]:mb-0" />
    </NodeViewWrapper>
  );
}

// ---------------- 原子块的通用外框 ----------------

function AtomFrame({
  title,
  selected,
  onDelete,
  children,
}: {
  title: string;
  selected: boolean;
  onDelete: () => void;
  children: ReactNode;
}) {
  return (
    <NodeViewWrapper
      data-drag-handle
      className={cn(
        "my-4 rounded-[var(--radius-md)] border border-border bg-card p-3 transition",
        selected && "border-primary ring-2 ring-primary/30",
      )}
    >
      <Bar className="mb-2 justify-between">
        <span className="font-medium">{title}</span>
        <button type="button" title="删除" className={iconBtn} onClick={onDelete}>
          <Trash2 className="size-3.5" />
        </button>
      </Bar>
      <div contentEditable={false}>{children}</div>
    </NodeViewWrapper>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: 输入框由 children 传入
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="w-12 shrink-0">{label}</span>
      {children}
    </label>
  );
}

function useUploader() {
  const [busy, setBusy] = useState(false);
  async function run(files: File[], onDone: (urls: string[]) => void) {
    if (!files.length) return;
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const f of files) urls.push(await uploadImage(f));
      onDone(urls);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return { busy, run };
}

// ---------------- 图集 ----------------

export function GalleryView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const images = (node.attrs.images ?? []) as GalleryImage[];
  const { busy, run } = useUploader();
  const set = (next: GalleryImage[]) => updateAttributes({ images: next });
  const move = (i: number, d: -1 | 1) => {
    const next = [...images];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j]!, next[i]!];
    set(next);
  };
  return (
    <AtomFrame title={`图集 · ${images.length} 张`} selected={selected} onDelete={deleteNode}>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {images.map((im, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: 同一张图可能加两次，地址不唯一
            key={`${im.src}-${i}`}
            className="group relative aspect-square overflow-hidden rounded-[var(--radius-sm)] bg-muted"
          >
            <img src={thumb(im.src, 320)} alt={im.alt ?? ""} className="size-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-black/50 p-1 opacity-0 transition group-hover:opacity-100">
              <button type="button" className="text-white" onClick={() => move(i, -1)} title="前移">
                <ArrowLeft className="size-3.5" />
              </button>
              <button
                type="button"
                className="text-white"
                onClick={() => set(images.filter((_, j) => j !== i))}
                title="移除"
              >
                <X className="size-3.5" />
              </button>
              <button type="button" className="text-white" onClick={() => move(i, 1)} title="后移">
                <ArrowRight className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={async () =>
            run(await pickImages(), (urls) => set([...images, ...urls.map((src) => ({ src }))]))
          }
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-[var(--radius-sm)] border border-dashed border-border text-xs text-muted-foreground transition hover:border-primary hover:text-primary"
        >
          {busy ? (
            <LoaderCircle className="size-5 animate-spin" />
          ) : (
            <ImagePlus className="size-5" />
          )}
          {busy ? "上传中…" : "添加图片"}
        </button>
      </div>
    </AtomFrame>
  );
}

// ---------------- 图集卡片 ----------------

export function GalleryCardView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const { busy, run } = useUploader();
  const a = node.attrs;
  return (
    <AtomFrame title="图集卡片" selected={selected} onDelete={deleteNode}>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={async () =>
            run(await pickImages(false), ([cover]) => updateAttributes({ cover }))
          }
          className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-muted text-xs text-muted-foreground"
          title="更换封面"
        >
          {a.cover ? (
            <img src={thumb(a.cover, 320)} alt="" className="size-full object-cover" />
          ) : (
            "上传封面"
          )}
          {busy && (
            <LoaderCircle className="absolute inset-0 m-auto size-5 animate-spin text-white" />
          )}
        </button>
        <div className="flex flex-1 flex-col gap-1.5">
          <Field label="名称">
            <input
              className={cn(input, "flex-1")}
              value={a.name ?? ""}
              onChange={(e) => updateAttributes({ name: e.target.value })}
            />
          </Field>
          <Field label="描述">
            <input
              className={cn(input, "flex-1")}
              value={a.desc ?? ""}
              onChange={(e) => updateAttributes({ desc: e.target.value || null })}
            />
          </Field>
          <Field label="链接">
            <input
              className={cn(input, "flex-1")}
              value={a.href ?? ""}
              placeholder="/gallery/…"
              onChange={(e) => updateAttributes({ href: e.target.value })}
            />
          </Field>
        </div>
      </div>
    </AtomFrame>
  );
}

// ---------------- 视频 ----------------

export function VideoView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const { busy, run } = useUploader();
  return (
    <AtomFrame title="视频" selected={selected} onDelete={deleteNode}>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={async () =>
            run(await pickImages(false), ([poster]) => updateAttributes({ poster }))
          }
          className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-[var(--radius-sm)] bg-muted text-xs text-muted-foreground"
          title="更换封面"
        >
          {node.attrs.poster ? (
            <img src={thumb(node.attrs.poster, 320)} alt="" className="size-full object-cover" />
          ) : (
            "上传封面"
          )}
        </button>
        <div className="flex flex-1 flex-col gap-1.5">
          <Field label="地址">
            <input
              className={cn(input, "flex-1")}
              value={node.attrs.src ?? ""}
              placeholder="https://….mp4 或 .m3u8"
              onChange={(e) => updateAttributes({ src: e.target.value })}
            />
          </Field>
          <p className="text-xs text-muted-foreground">前台先显示封面，点击后才加载视频。</p>
        </div>
      </div>
    </AtomFrame>
  );
}

// ---------------- 音乐 ----------------

export function MusicView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const a = node.attrs;
  return (
    <AtomFrame title="音乐" selected={selected} onDelete={deleteNode}>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className={input}
          value={a.server}
          onChange={(e) => updateAttributes({ server: e.target.value })}
        >
          <option value="netease">网易云</option>
          <option value="tencent">QQ 音乐</option>
          <option value="kugou">酷狗</option>
          <option value="baidu">百度</option>
          <option value="kuwo">酷我</option>
        </select>
        <select
          className={input}
          value={a.type}
          onChange={(e) => updateAttributes({ type: e.target.value })}
        >
          <option value="song">单曲</option>
          <option value="playlist">歌单</option>
          <option value="album">专辑</option>
          <option value="artist">艺术家</option>
        </select>
        <input
          className={cn(input, "w-48")}
          value={a.mid ?? ""}
          placeholder="ID（链接里的数字）"
          onChange={(e) => updateAttributes({ mid: e.target.value.trim() })}
        />
      </div>
    </AtomFrame>
  );
}

// ---------------- 嵌入 ----------------

export function EmbedView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const src = toEmbedSrc(String(node.attrs.src ?? ""));
  return (
    <AtomFrame title="嵌入" selected={selected} onDelete={deleteNode}>
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            className={cn(input, "flex-1")}
            value={node.attrs.src ?? ""}
            placeholder="粘贴 B 站 / YouTube 视频链接或播放器地址"
            onChange={(e) =>
              updateAttributes({ src: toEmbedSrc(e.target.value) ?? e.target.value })
            }
          />
          <select
            className={input}
            value={node.attrs.ratio}
            onChange={(e) => updateAttributes({ ratio: e.target.value })}
          >
            <option value="16/9">16:9</option>
            <option value="4/3">4:3</option>
            <option value="1/1">1:1</option>
            <option value="9/16">9:16</option>
          </select>
        </div>
        {src ? (
          <div
            className="pointer-events-none overflow-hidden rounded-[var(--radius-sm)] bg-muted"
            style={{ aspectRatio: node.attrs.ratio }}
          >
            <iframe
              src={src}
              title="预览"
              className="size-full"
              sandbox="allow-scripts allow-same-origin"
            />
          </div>
        ) : (
          node.attrs.src && (
            <p className="text-xs text-destructive">
              不支持这个地址（只允许 B 站、YouTube、网易云等白名单站点）
            </p>
          )
        )}
      </div>
    </AtomFrame>
  );
}

// ---------------- 行内按钮 ----------------

const BTN_COLORS = ["", "pink", "blue", "green", "red", "purple", "yellow", "gray"];

export function ButtonLinkView({ node, updateAttributes, selected }: NodeViewProps) {
  const a = node.attrs;
  const words = String(a.variant ?? "")
    .split(/\s+/)
    .filter(Boolean);
  const color = words.find((w) => BTN_COLORS.includes(w)) ?? "";
  const block = words.includes("block");
  const setVariant = (c: string, b: boolean) =>
    updateAttributes({ variant: [c, b ? "block" : ""].filter(Boolean).join(" ") || null });
  return (
    <NodeViewWrapper as="span" className="relative inline-block align-middle">
      <span
        data-drag-handle
        className={cn(
          "inline-flex cursor-pointer items-center gap-1 rounded-pill px-3 py-1 text-sm font-medium",
          color && color !== "gray"
            ? "bg-primary text-primary-foreground"
            : "bg-soft text-accent-foreground",
          selected && "ring-2 ring-primary/40",
        )}
      >
        {a.text || "按钮"}
      </span>
      {selected && (
        <span
          contentEditable={false}
          className="absolute top-full left-0 z-20 mt-1 flex w-72 flex-col gap-1.5 rounded-[var(--radius-md)] border border-border bg-popover p-2 shadow-lg"
        >
          <Field label="文字">
            <input
              className={cn(input, "flex-1")}
              value={a.text ?? ""}
              onChange={(e) => updateAttributes({ text: e.target.value })}
            />
          </Field>
          <Field label="链接">
            <input
              className={cn(input, "flex-1")}
              value={a.href ?? ""}
              placeholder="https://…"
              onChange={(e) => updateAttributes({ href: e.target.value })}
            />
          </Field>
          <Field label="颜色">
            <select
              className={cn(input, "flex-1")}
              value={color}
              onChange={(e) => setVariant(e.target.value, block)}
            >
              {BTN_COLORS.map((c) => (
                <option key={c} value={c}>
                  {c || "默认"}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={block}
              onChange={(e) => setVariant(color, e.target.checked)}
            />{" "}
            占满整行
          </label>
        </span>
      )}
    </NodeViewWrapper>
  );
}

// ---------------- 图片 ----------------

const WIDTHS = ["25%", "50%", "75%", "100%"];

export function ImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const a = node.attrs;
  const { busy, run } = useUploader();
  const margin = a.align === "left" ? "0 auto 0 0" : a.align === "right" ? "0 0 0 auto" : "0 auto";
  return (
    <NodeViewWrapper className="my-5">
      <figure style={{ width: a.width ?? undefined, margin }} className="relative">
        <img
          data-drag-handle
          src={a.src}
          alt={a.alt ?? ""}
          className={cn("mx-auto rounded-[var(--radius-md)]", selected && "ring-2 ring-primary")}
        />
        {busy && (
          <LoaderCircle className="absolute inset-0 m-auto size-6 animate-spin text-white" />
        )}
        {(selected || a.title) && (
          <input
            contentEditable={false}
            className="mt-2 w-full bg-transparent text-center text-sm text-muted-foreground outline-none"
            placeholder="图片说明（可选）"
            value={a.title ?? ""}
            onChange={(e) => updateAttributes({ title: e.target.value || null })}
          />
        )}
      </figure>
      {selected && (
        <Bar className="mt-2 justify-center">
          {WIDTHS.map((w) => (
            <button
              key={w}
              type="button"
              className={cn(
                iconBtn,
                "w-auto px-1.5",
                (a.width ?? "100%") === w && "bg-muted text-foreground",
              )}
              onClick={() => updateAttributes({ width: w === "100%" ? null : w })}
            >
              {w}
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          {(
            [
              ["left", AlignLeft],
              ["center", AlignCenter],
              ["right", AlignRight],
            ] as const
          ).map(([v, Icon]) => (
            <button
              key={v}
              type="button"
              className={cn(iconBtn, (a.align ?? "center") === v && "bg-muted text-foreground")}
              onClick={() => updateAttributes({ align: v === "center" ? null : v })}
            >
              <Icon className="size-3.5" />
            </button>
          ))}
          <span className="mx-1 h-4 w-px bg-border" />
          <input
            className={cn(input, "w-40")}
            placeholder="替代文字 alt"
            value={a.alt ?? ""}
            onChange={(e) => updateAttributes({ alt: e.target.value || null })}
          />
          <button
            type="button"
            className={cn(iconBtn, "w-auto gap-1 px-1.5")}
            onClick={async () => run(await pickImages(false), ([src]) => updateAttributes({ src }))}
          >
            <ImagePlus className="size-3.5" /> 替换
          </button>
        </Bar>
      )}
    </NodeViewWrapper>
  );
}

// ---------------- 代码块 ----------------

const LANGS = [
  "",
  "bash",
  "c",
  "cpp",
  "csharp",
  "css",
  "diff",
  "go",
  "java",
  "javascript",
  "json",
  "kotlin",
  "lua",
  "markdown",
  "php",
  "python",
  "ruby",
  "rust",
  "sql",
  "swift",
  "typescript",
  "xml",
  "yaml",
];

export function CodeBlockView({ node, updateAttributes }: NodeViewProps) {
  const lang = node.attrs.language ?? "";
  return (
    <NodeViewWrapper className="relative my-4">
      <select
        contentEditable={false}
        className={cn(input, "absolute top-2 right-2 z-10 h-6 opacity-70 hover:opacity-100")}
        value={LANGS.includes(lang) ? lang : lang}
        onChange={(e) => updateAttributes({ language: e.target.value || null })}
      >
        {!LANGS.includes(lang) && <option value={lang}>{lang}</option>}
        {LANGS.map((l) => (
          <option key={l} value={l}>
            {l || "纯文本"}
          </option>
        ))}
      </select>
      <pre className="overflow-x-auto rounded-[var(--radius-md)] bg-soft p-4 text-[13px]">
        <NodeViewContent<"code"> as="code" className={lang ? `hljs language-${lang}` : "hljs"} />
      </pre>
    </NodeViewWrapper>
  );
}
