/**
 * 正文的完整 schema：后台编辑器、服务端校验、迁移脚本共用这一份，保证三边认的节点一致。
 * 只含 schema 层面的扩展；编辑器专属的交互（占位符、拖拽手柄、斜杠菜单、粘贴上传…）
 * 在 components/editor 里追加。前台不加载这个文件（见 components/content/rich-content.tsx）。
 */
import type { AnyExtension } from "@tiptap/core";
import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { Details, DetailsContent, DetailsSummary } from "@tiptap/extension-details";
import { Highlight } from "@tiptap/extension-highlight";
import { Image } from "@tiptap/extension-image";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Mathematics } from "@tiptap/extension-mathematics";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { TableKit } from "@tiptap/extension-table";
import { TextAlign } from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { StarterKit } from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import {
  ButtonLink,
  Callout,
  Embed,
  Gallery,
  GalleryCard,
  Music,
  Tab,
  Tabs,
  Timeline,
  TimelineItem,
  Video,
} from "./nodes";

export const lowlight = createLowlight(common);

/** 图片：块级，加宽度（百分比）和对齐 */
export const ContentImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-width"),
        renderHTML: (a) => (a.width ? { "data-width": a.width } : {}),
      },
      align: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-align"),
        renderHTML: (a) => (a.align ? { "data-align": a.align } : {}),
      },
    };
  },
}).configure({ inline: false, allowBase64: false });

/** 折叠块（Hexo hideToggle / hideBlock）：沿用官方 Details，加一个强调色 */
export const ContentDetails = Details.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      color: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-color"),
        renderHTML: (a) => (a.color ? { "data-color": a.color } : {}),
      },
    };
  },
}).configure({ persist: true });

export const contentExtensions: AnyExtension[] = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3, 4] },
    codeBlock: false,
    link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
  }),
  CodeBlockLowlight.configure({ lowlight, defaultLanguage: null }),
  TaskList,
  TaskItem.configure({ nested: true }),
  TableKit.configure({ table: { resizable: true } }),
  ContentImage,
  Highlight.configure({ multicolor: true }),
  TextStyle,
  Color,
  TextAlign.configure({ types: ["heading", "paragraph"] }),
  Subscript,
  Superscript,
  ContentDetails,
  DetailsSummary,
  DetailsContent,
  Mathematics,
  Callout,
  Tabs,
  Tab,
  Timeline,
  TimelineItem,
  ButtonLink,
  Gallery,
  GalleryCard,
  Video,
  Music,
  Embed,
];
