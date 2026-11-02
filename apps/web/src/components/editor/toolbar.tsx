/** 编辑器顶部工具栏（吸顶）。按钮状态用 useEditorState 订阅，只在相关状态变化时重渲染。 */
import { cn } from "@i/ui";
import { type Editor, useEditorState } from "@tiptap/react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code,
  Highlighter,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  type LucideIcon,
  Palette,
  Plus,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  Underline,
  Undo2,
} from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { INSERT_ITEMS, pickAndInsertImages } from "./insert-items";
import { COLORS } from "./node-views";

export function Btn({
  icon: Icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()} // 不抢编辑器焦点、不丢选区
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-[var(--radius-sm)] transition disabled:opacity-40",
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

const Sep = () => <span className="mx-1 h-5 w-px shrink-0 bg-border" />;

/** 点开的小弹层（颜色、插入菜单），点外面关闭 */
export function Popover({
  trigger,
  children,
  align = "left",
}: {
  trigger: (open: boolean, toggle: () => void) => ReactNode;
  children: (close: () => void) => ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger(open, () => setOpen((o) => !o))}
      {open && (
        <div
          className={cn(
            "absolute top-full z-30 mt-1 rounded-[var(--radius-md)] border border-border bg-popover p-1 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

export function setLink(editor: Editor) {
  const prev = editor.getAttributes("link").href as string | undefined;
  const href = window.prompt("链接地址（留空则移除链接）", prev ?? "https://");
  if (href == null) return;
  if (!href.trim()) editor.chain().focus().extendMarkRange("link").unsetLink().run();
  else editor.chain().focus().extendMarkRange("link").setLink({ href: href.trim() }).run();
}

export function ColorMenu({ editor }: { editor: Editor }) {
  return (
    <Popover
      trigger={(open, toggle) => (
        <Btn icon={Palette} label="文字颜色 / 背景高亮" active={open} onClick={toggle} />
      )}
    >
      {(close) => (
        <div className="w-48 p-1 text-xs">
          <div className="mb-1 text-muted-foreground">文字颜色</div>
          <div className="mb-2 flex flex-wrap gap-1">
            <button
              type="button"
              className="h-6 rounded border border-border px-1.5"
              onClick={() => {
                editor.chain().focus().unsetColor().run();
                close();
              }}
            >
              默认
            </button>
            {COLORS.filter((c) => c.value).map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.label}
                className="size-6 rounded border border-border"
                style={{ background: c.css }}
                onClick={() => {
                  editor.chain().focus().setColor(c.css).run();
                  close();
                }}
              />
            ))}
          </div>
          <div className="mb-1 text-muted-foreground">背景高亮</div>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className="h-6 rounded border border-border px-1.5"
              onClick={() => {
                editor.chain().focus().unsetHighlight().run();
                close();
              }}
            >
              无
            </button>
            {COLORS.filter((c) => c.value).map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.label}
                className="size-6 rounded border border-border"
                style={{ background: `color-mix(in srgb, ${c.css} 30%, transparent)` }}
                onClick={() => {
                  editor
                    .chain()
                    .focus()
                    .setHighlight({ color: `color-mix(in srgb, ${c.css} 30%, transparent)` })
                    .run();
                  close();
                }}
              />
            ))}
          </div>
        </div>
      )}
    </Popover>
  );
}

const BLOCK_TYPES = [
  { value: "p", label: "正文" },
  { value: "1", label: "标题 1" },
  { value: "2", label: "标题 2" },
  { value: "3", label: "标题 3" },
  { value: "4", label: "标题 4" },
];

export function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      block: e.isActive("heading") ? String(e.getAttributes("heading").level) : "p",
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      sub: e.isActive("subscript"),
      sup: e.isActive("superscript"),
      highlight: e.isActive("highlight"),
      link: e.isActive("link"),
      ul: e.isActive("bulletList"),
      ol: e.isActive("orderedList"),
      task: e.isActive("taskList"),
      quote: e.isActive("blockquote"),
      left: e.isActive({ textAlign: "left" }),
      center: e.isActive({ textAlign: "center" }),
      right: e.isActive({ textAlign: "right" }),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const c = () => editor.chain().focus();

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-0.5 border-b border-border bg-background/95 px-2 py-1.5 backdrop-blur">
      <Btn icon={Undo2} label="撤销 (⌘Z)" disabled={!s.canUndo} onClick={() => c().undo().run()} />
      <Btn icon={Redo2} label="重做 (⌘⇧Z)" disabled={!s.canRedo} onClick={() => c().redo().run()} />
      <Sep />
      <select
        aria-label="段落类型"
        value={s.block}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "p") c().setParagraph().run();
          else
            c()
              .setHeading({ level: Number(v) as 1 | 2 | 3 | 4 })
              .run();
        }}
        className="h-8 rounded-[var(--radius-sm)] bg-transparent px-1.5 text-sm text-foreground outline-none hover:bg-muted"
      >
        {BLOCK_TYPES.map((b) => (
          <option key={b.value} value={b.value}>
            {b.label}
          </option>
        ))}
      </select>
      <Sep />
      <Btn icon={Bold} label="粗体 (⌘B)" active={s.bold} onClick={() => c().toggleBold().run()} />
      <Btn
        icon={Italic}
        label="斜体 (⌘I)"
        active={s.italic}
        onClick={() => c().toggleItalic().run()}
      />
      <Btn
        icon={Underline}
        label="下划线 (⌘U)"
        active={s.underline}
        onClick={() => c().toggleUnderline().run()}
      />
      <Btn
        icon={Strikethrough}
        label="删除线"
        active={s.strike}
        onClick={() => c().toggleStrike().run()}
      />
      <Btn icon={Code} label="行内代码" active={s.code} onClick={() => c().toggleCode().run()} />
      <Btn
        icon={Highlighter}
        label="高亮"
        active={s.highlight}
        onClick={() => c().toggleHighlight().run()}
      />
      <ColorMenu editor={editor} />
      <Btn icon={Link2} label="链接 (⌘K)" active={s.link} onClick={() => setLink(editor)} />
      <Btn
        icon={Superscript}
        label="上标"
        active={s.sup}
        onClick={() => c().toggleSuperscript().run()}
      />
      <Btn
        icon={Subscript}
        label="下标"
        active={s.sub}
        onClick={() => c().toggleSubscript().run()}
      />
      <Btn
        icon={RemoveFormatting}
        label="清除格式"
        onClick={() => c().unsetAllMarks().clearNodes().run()}
      />
      <Sep />
      <Btn
        icon={AlignLeft}
        label="左对齐"
        active={s.left}
        onClick={() => c().setTextAlign("left").run()}
      />
      <Btn
        icon={AlignCenter}
        label="居中"
        active={s.center}
        onClick={() => c().setTextAlign("center").run()}
      />
      <Btn
        icon={AlignRight}
        label="右对齐"
        active={s.right}
        onClick={() => c().setTextAlign("right").run()}
      />
      <Sep />
      <Btn
        icon={List}
        label="无序列表"
        active={s.ul}
        onClick={() => c().toggleBulletList().run()}
      />
      <Btn
        icon={ListOrdered}
        label="有序列表"
        active={s.ol}
        onClick={() => c().toggleOrderedList().run()}
      />
      <Btn
        icon={ListChecks}
        label="待办清单"
        active={s.task}
        onClick={() => c().toggleTaskList().run()}
      />
      <Btn
        icon={Quote}
        label="引用"
        active={s.quote}
        onClick={() => c().toggleBlockquote().run()}
      />
      <Sep />
      <Btn icon={ImagePlus} label="插入图片" onClick={() => void pickAndInsertImages(editor)} />
      <Btn
        icon={Table}
        label="插入表格"
        onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      />
      <Popover
        align="right"
        trigger={(open, toggle) => (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={toggle}
            className={cn(
              "inline-flex h-8 items-center gap-1 rounded-[var(--radius-sm)] px-2 text-sm transition",
              open
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Plus className="size-4" /> 插入 <ChevronDown className="size-3.5" />
          </button>
        )}
      >
        {(close) => (
          <div className="grid w-80 grid-cols-2 gap-0.5">
            {INSERT_ITEMS.filter(
              (i) => i.group !== "基础" || ["table", "math", "code", "hr"].includes(i.key),
            ).map((it) => (
              <button
                key={it.key}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  it.run(editor);
                  close();
                }}
                className="flex items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-sm hover:bg-muted"
              >
                <it.icon className="size-4 text-muted-foreground" />
                {it.label}
              </button>
            ))}
          </div>
        )}
      </Popover>
    </div>
  );
}
