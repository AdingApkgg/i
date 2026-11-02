/**
 * 可插入的块：斜杠菜单（/）和工具栏「插入」共用。
 * keywords 用于斜杠菜单搜索（中文名、拼音首字母、英文都能搜到）。
 */
import type { Editor } from "@tiptap/react";
import {
  AppWindow,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Images,
  LayoutGrid,
  List,
  ListChecks,
  ListCollapse,
  ListOrdered,
  type LucideIcon,
  Megaphone,
  Minus,
  Music,
  PanelTop,
  Pilcrow,
  Quote,
  Sigma,
  SquareMousePointer,
  Table,
  Video,
  Waypoints,
} from "lucide-react";
import { toast } from "sonner";
import { pickImages, uploadImage } from "./upload";

export interface InsertItem {
  key: string;
  label: string;
  group: "基础" | "列表" | "媒体" | "组件";
  keywords: string;
  icon: LucideIcon;
  run: (editor: Editor) => void;
}

const p = () => ({ type: "paragraph" });

/**
 * 插入带内容的块（提示框、标签页、时间轴），并把光标放进它的第一个可输入段落。
 * 直接 insertContent 的话光标会落在块的末尾（标签页就是最后一个标签里）。
 */
function insertContainer(editor: Editor, node: Record<string, unknown>) {
  const start = Math.max(0, editor.state.selection.from - 1);
  editor.chain().focus().insertContent(node).run();
  const { doc } = editor.state;
  let target: number | null = null;
  doc.nodesBetween(start, doc.content.size, (n, pos) => {
    if (target != null) return false;
    if (n.isTextblock && n.type.name !== "detailsSummary") {
      target = pos + 1;
      return false;
    }
    return true;
  });
  if (target != null) editor.chain().focus().setTextSelection(target).run();
}

/** 选图上传后插入（多张时逐张插入） */
export async function insertImages(editor: Editor, files: File[], pos?: number) {
  const id = toast.loading(`上传 ${files.length} 张图片…`);
  try {
    let at = pos;
    for (const f of files) {
      const src = await uploadImage(f);
      const node = { type: "image", attrs: { src, alt: f.name.replace(/\.[^.]+$/, "") } };
      if (at == null) editor.chain().focus().insertContent(node).run();
      else {
        editor.chain().insertContentAt(at, node).run();
        at += 1;
      }
    }
    toast.success("图片已插入", { id });
  } catch (e) {
    toast.error((e as Error).message, { id });
  }
}

/** 弹出选图框，选中的图片上传后插入到光标处 */
export async function pickAndInsertImages(editor: Editor) {
  const files = await pickImages();
  if (files.length) await insertImages(editor, files);
}

export const INSERT_ITEMS: InsertItem[] = [
  {
    key: "p",
    label: "正文",
    group: "基础",
    keywords: "paragraph text zw 正文 段落",
    icon: Pilcrow,
    run: (e) => e.chain().focus().setParagraph().run(),
  },
  {
    key: "h1",
    label: "一级标题",
    group: "基础",
    keywords: "h1 heading bt 标题",
    icon: Heading1,
    run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    key: "h2",
    label: "二级标题",
    group: "基础",
    keywords: "h2 heading bt 标题",
    icon: Heading2,
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    key: "h3",
    label: "三级标题",
    group: "基础",
    keywords: "h3 heading bt 标题",
    icon: Heading3,
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    key: "quote",
    label: "引用",
    group: "基础",
    keywords: "quote blockquote yy 引用",
    icon: Quote,
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    key: "code",
    label: "代码块",
    group: "基础",
    keywords: "code dmk 代码",
    icon: Code2,
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
  {
    key: "hr",
    label: "分割线",
    group: "基础",
    keywords: "hr divider fgx 分割线",
    icon: Minus,
    run: (e) => e.chain().focus().setHorizontalRule().run(),
  },
  {
    key: "table",
    label: "表格",
    group: "基础",
    keywords: "table bg 表格",
    icon: Table,
    run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    key: "math",
    label: "公式",
    group: "基础",
    keywords: "math latex katex gs 公式 数学",
    icon: Sigma,
    run: (e) => e.chain().focus().insertBlockMath({ latex: "E = mc^2" }).run(),
  },

  {
    key: "ul",
    label: "无序列表",
    group: "列表",
    keywords: "bullet list lb 列表",
    icon: List,
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    key: "ol",
    label: "有序列表",
    group: "列表",
    keywords: "ordered list lb 列表 编号",
    icon: ListOrdered,
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    key: "task",
    label: "待办清单",
    group: "列表",
    keywords: "todo task db 待办 清单",
    icon: ListChecks,
    run: (e) => e.chain().focus().toggleTaskList().run(),
  },

  {
    key: "image",
    label: "图片",
    group: "媒体",
    keywords: "image img tp 图片 上传",
    icon: ImagePlus,
    run: (e) => void pickAndInsertImages(e),
  },
  {
    key: "gallery",
    label: "图集",
    group: "媒体",
    keywords: "gallery tj 图集 相册 瀑布流",
    icon: Images,
    run: (e) =>
      e
        .chain()
        .focus()
        .insertContent({ type: "gallery", attrs: { images: [] } })
        .run(),
  },
  {
    key: "galleryCard",
    label: "图集卡片",
    group: "媒体",
    keywords: "gallery card tjkp 图集 卡片",
    icon: LayoutGrid,
    run: (e) => e.chain().focus().insertContent({ type: "galleryCard" }).run(),
  },
  {
    key: "video",
    label: "视频",
    group: "媒体",
    keywords: "video sp 视频 m3u8 mp4",
    icon: Video,
    run: (e) => e.chain().focus().insertContent({ type: "video" }).run(),
  },
  {
    key: "music",
    label: "音乐",
    group: "媒体",
    keywords: "music meting yy 音乐 网易云 歌单",
    icon: Music,
    run: (e) => e.chain().focus().insertContent({ type: "music" }).run(),
  },
  {
    key: "embed",
    label: "嵌入（B 站 / YouTube）",
    group: "媒体",
    keywords: "embed iframe bilibili youtube qr 嵌入 视频",
    icon: AppWindow,
    run: (e) => e.chain().focus().insertContent({ type: "embed" }).run(),
  },

  {
    key: "callout",
    label: "提示框",
    group: "组件",
    keywords: "callout note tsk 提示 注意 公告",
    icon: Megaphone,
    run: (e) => insertContainer(e, { type: "callout", content: [p()] }),
  },
  {
    key: "details",
    label: "折叠块",
    group: "组件",
    keywords: "details collapse toggle zdk 折叠 展开 隐藏",
    icon: ListCollapse,
    run: (e) => e.chain().focus().setDetails().run(),
  },
  {
    key: "tabs",
    label: "标签页",
    group: "组件",
    keywords: "tabs bqy 标签 选项卡",
    icon: PanelTop,
    run: (e) =>
      insertContainer(e, {
        type: "tabs",
        content: [
          { type: "tab", attrs: { label: "标签 1" }, content: [p()] },
          { type: "tab", attrs: { label: "标签 2" }, content: [p()] },
        ],
      }),
  },
  {
    key: "timeline",
    label: "时间轴",
    group: "组件",
    keywords: "timeline sjz 时间轴 年表",
    icon: Waypoints,
    run: (e) =>
      insertContainer(e, {
        type: "timeline",
        content: [{ type: "timelineItem", attrs: { label: "" }, content: [p()] }],
      }),
  },
  {
    key: "button",
    label: "按钮链接",
    group: "组件",
    keywords: "button btn an 按钮 链接",
    icon: SquareMousePointer,
    run: (e) =>
      e
        .chain()
        .focus()
        .insertContent({ type: "buttonLink", attrs: { text: "按钮", href: "" } })
        .run(),
  },
];
