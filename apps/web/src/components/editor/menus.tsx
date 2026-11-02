/** 浮动菜单：选中文字时的格式菜单、光标在表格里时的表格菜单 */
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Bold,
  Code,
  Columns2,
  Highlighter,
  Italic,
  Link2,
  PanelTop,
  Rows2,
  Strikethrough,
  TableCellsMerge,
  TableCellsSplit,
  Trash2,
  Underline,
} from "lucide-react";
import { Btn, ColorMenu, setLink } from "./toolbar";

const panel =
  "flex items-center gap-0.5 rounded-[var(--radius-md)] border border-border bg-popover p-1 shadow-lg";

export function TextBubbleMenu({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      highlight: e.isActive("highlight"),
      link: e.isActive("link"),
    }),
  });
  const c = () => editor.chain().focus();
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="textBubble"
      // 只在选中一段文字时出现：节点选区（图片、块）、代码块、空选区都不弹
      shouldShow={({ editor: e, state, from, to }) => {
        if (from === to || !e.isEditable) return false;
        if (e.isActive("codeBlock")) return false;
        const sel = state.selection as { node?: unknown };
        if (sel.node) return false;
        return state.doc.textBetween(from, to).trim().length > 0;
      }}
      className={panel}
    >
      <Btn icon={Bold} label="粗体" active={s.bold} onClick={() => c().toggleBold().run()} />
      <Btn icon={Italic} label="斜体" active={s.italic} onClick={() => c().toggleItalic().run()} />
      <Btn
        icon={Underline}
        label="下划线"
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
      <Btn icon={Link2} label="链接" active={s.link} onClick={() => setLink(editor)} />
    </BubbleMenu>
  );
}

export function TableMenu({ editor }: { editor: Editor }) {
  const c = () => editor.chain().focus();
  return (
    <BubbleMenu
      editor={editor}
      pluginKey="tableMenu"
      shouldShow={({ editor: e }) => e.isActive("table")}
      options={{ placement: "top" }}
      className={panel}
    >
      <Btn icon={ArrowUpToLine} label="上方插入行" onClick={() => c().addRowBefore().run()} />
      <Btn icon={ArrowDownToLine} label="下方插入行" onClick={() => c().addRowAfter().run()} />
      <Btn icon={Rows2} label="删除行" onClick={() => c().deleteRow().run()} />
      <span className="mx-1 h-5 w-px bg-border" />
      <Btn icon={ArrowLeftToLine} label="左侧插入列" onClick={() => c().addColumnBefore().run()} />
      <Btn icon={ArrowRightToLine} label="右侧插入列" onClick={() => c().addColumnAfter().run()} />
      <Btn icon={Columns2} label="删除列" onClick={() => c().deleteColumn().run()} />
      <span className="mx-1 h-5 w-px bg-border" />
      <Btn icon={TableCellsMerge} label="合并单元格" onClick={() => c().mergeCells().run()} />
      <Btn icon={TableCellsSplit} label="拆分单元格" onClick={() => c().splitCell().run()} />
      <Btn icon={PanelTop} label="切换表头行" onClick={() => c().toggleHeaderRow().run()} />
      <span className="mx-1 h-5 w-px bg-border" />
      <Btn icon={Trash2} label="删除表格" onClick={() => c().deleteTable().run()} />
    </BubbleMenu>
  );
}
