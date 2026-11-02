/**
 * 编辑器用的扩展：在共享 schema（lib/content/extensions.ts）上挂 NodeView，
 * 再加上编辑专属的交互（占位提示、字数统计、粘贴 / 拖入图片上传、斜杠菜单）。
 * schema 不变，所以编辑器产出的 JSON 和服务端校验、前台渲染认的是同一套节点。
 */
import type { AnyExtension, Node } from "@tiptap/core";
import { FileHandler } from "@tiptap/extension-file-handler";
import { Mathematics } from "@tiptap/extension-mathematics";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { type Editor, ReactNodeViewRenderer } from "@tiptap/react";
import { contentExtensions } from "@/lib/content/extensions";
import { insertImages } from "./insert-items";
import {
  ButtonLinkView,
  CalloutView,
  CodeBlockView,
  EmbedView,
  GalleryCardView,
  GalleryView,
  ImageView,
  MusicView,
  TabsView,
  TabView,
  TimelineItemView,
  TimelineView,
  VideoView,
} from "./node-views";
import { SlashCommand } from "./slash-command";
import { IMAGE_MIME } from "./upload";

// NodeView 组件只用到 NodeViewProps 的字段，ReactNodeViewRenderer 要求的是它的超集
const VIEWS: Record<string, Parameters<typeof ReactNodeViewRenderer>[0]> = {
  callout: CalloutView,
  tabs: TabsView,
  tab: TabView,
  timeline: TimelineView,
  timelineItem: TimelineItemView,
  gallery: GalleryView,
  galleryCard: GalleryCardView,
  video: VideoView,
  music: MusicView,
  embed: EmbedView,
  buttonLink: ButtonLinkView,
  image: ImageView,
  codeBlock: CodeBlockView,
};

/** 点公式时弹框改 LaTeX（KaTeX 渲染由 Mathematics 扩展负责）。onClick 拿不到 editor，由调用方传 getEditor */
function editLatex(current: string): string | null {
  const next = window.prompt("编辑 LaTeX 公式", current);
  return next == null || next === current ? null : next;
}

export function editorExtensions(getEditor: () => Editor | null): AnyExtension[] {
  const base = contentExtensions.map((ext) => {
    const view = VIEWS[ext.name];
    // extend 出的子扩展要重新 configure 一遍，否则 lowlight 等已配置的选项会丢
    if (view)
      return (ext as Node)
        .extend({ addNodeView: () => ReactNodeViewRenderer(view) })
        .configure(ext.options);
    if (ext.name === Mathematics.name)
      return Mathematics.configure({
        inlineOptions: {
          onClick: (node, pos) => {
            const latex = editLatex(node.attrs.latex);
            if (latex != null)
              getEditor()?.chain().setNodeSelection(pos).updateInlineMath({ latex }).focus().run();
          },
        },
        blockOptions: {
          onClick: (node, pos) => {
            const latex = editLatex(node.attrs.latex);
            if (latex != null)
              getEditor()?.chain().setNodeSelection(pos).updateBlockMath({ latex }).focus().run();
          },
        },
        katexOptions: { throwOnError: false },
      });
    return ext;
  });

  return [
    ...base,
    Placeholder.configure({
      placeholder: ({ node }) =>
        node.type.name === "heading" ? "标题" : "输入 / 插入图片、提示框、标签页等…",
      includeChildren: false,
    }),
    CharacterCount,
    FileHandler.configure({
      allowedMimeTypes: IMAGE_MIME,
      consumePasteEvent: true,
      onDrop: (editor, files, pos) => void insertImages(editor, files, pos),
      onPaste: (editor, files) => void insertImages(editor, files),
    }),
    SlashCommand,
  ];
}
