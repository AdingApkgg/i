/**
 * 后台富文本编辑器（Tiptap）。只在后台路由里懒加载，前台页面包不含编辑器。
 * 输出 Tiptap JSON（schema 见 lib/content/extensions.ts），由调用方负责保存。
 */
import { DragHandle } from "@tiptap/extension-drag-handle-react";
import { type Editor, EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { GripVertical } from "lucide-react";
import { useMemo, useRef } from "react";
import type { RichDoc } from "@/lib/content/types";
import { editorExtensions } from "./extensions";
import { TableMenu, TextBubbleMenu } from "./menus";
import { setLink, Toolbar } from "./toolbar";
import "katex/dist/katex.min.css";
import "./editor.css";

export function RichEditor({
  initialContent,
  onChange,
  onReady,
}: {
  initialContent: RichDoc;
  onChange?: (doc: RichDoc) => void;
  onReady?: (editor: Editor) => void;
}) {
  const ref = useRef<Editor | null>(null);
  const extensions = useMemo(() => editorExtensions(() => ref.current), []);
  const editor = useEditor({
    extensions,
    content: initialContent,
    // SSR 时不创建编辑器，挂载后再初始化，避免 hydration 不一致
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        class:
          "prose-content rich-editor min-h-[60vh] px-6 py-6 text-[15px] leading-relaxed outline-none sm:px-12",
        spellcheck: "false",
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k" && ref.current) {
          event.preventDefault();
          setLink(ref.current);
          return true;
        }
        return false;
      },
    },
    onCreate: ({ editor: e }) => {
      ref.current = e;
      onReady?.(e);
    },
    onUpdate: ({ editor: e }) => onChange?.(e.getJSON() as RichDoc),
  });

  if (!editor)
    return <div className="min-h-[60vh] animate-pulse rounded-[var(--radius-md)] bg-muted/50" />;

  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-card">
      <Toolbar editor={editor} />
      <DragHandle editor={editor}>
        <div className="flex h-6 w-4 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing">
          <GripVertical className="size-3.5" />
        </div>
      </DragHandle>
      <TextBubbleMenu editor={editor} />
      <TableMenu editor={editor} />
      <EditorContent editor={editor} />
      <Footer editor={editor} />
    </div>
  );
}

function Footer({ editor }: { editor: Editor }) {
  const { chars, words } = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      chars: e.storage.characterCount.characters() as number,
      words: e.storage.characterCount.words() as number,
    }),
  });
  return (
    <div className="flex justify-end gap-3 border-t border-border px-4 py-1.5 text-xs text-muted-foreground">
      <span>{chars} 字符</span>
      <span>{words} 词</span>
      <span className="hidden sm:inline">
        输入 / 插入块 · 拖动左侧把手调整顺序 · 粘贴图片自动上传
      </span>
    </div>
  );
}
