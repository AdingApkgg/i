import { compileHexo } from "@/lib/hexo/compile.server";
import { prepareDoc } from "./prepare.server";
import type { RichDoc, TocItem } from "./types";

/** loader 下发给 <ArticleBody> 的正文：新的富文本，或迁移前的旧 Markdown */
export type ArticleBodyData =
  | { kind: "rich"; doc: RichDoc; toc: TocItem[]; hasMath: boolean }
  | { kind: "legacy"; code: string | null; source: string };

const hasType = (n: { type: string; content?: unknown[] }, types: string[]): boolean =>
  types.includes(n.type) ||
  (n.content ?? []).some((c) => hasType(c as { type: string; content?: unknown[] }, types));

/**
 * 有 content（Tiptap JSON）就用它；还没迁移的旧记录继续走 Hexo Markdown → MDX。
 * 迁移完成、contentMd 删除后，legacy 分支一起删掉。
 */
export async function loadArticleBody(row: {
  content?: unknown;
  contentMd?: string | null;
}): Promise<ArticleBodyData> {
  if (row.content) {
    const { doc, toc } = prepareDoc(row.content as RichDoc);
    return { kind: "rich", doc, toc, hasMath: hasType(doc, ["inlineMath", "blockMath"]) };
  }
  const md = row.contentMd ?? "";
  const code = await compileHexo(md);
  // 编译好的 MDX 已含全文；只有编译失败（回退纯 markdown 渲染）时才下发原文
  return { kind: "legacy", code, source: code ? "" : md };
}
