/**
 * Tiptap / ProseMirror 文档的 JSON 形状（与 @tiptap/core 的 JSONContent 兼容）。
 * 单独定义而不是从 @tiptap/core 引类型，前台渲染只依赖这个文件，不把编辑器打进页面包。
 */
export interface RichMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface RichNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  marks?: RichMark[];
  text?: string;
}

/** 文档根节点 */
export type RichDoc = RichNode & { type: "doc" };

export interface TocItem {
  id: string;
  level: number;
  text: string;
}

export const emptyDoc = (): RichDoc => ({ type: "doc", content: [{ type: "paragraph" }] });
