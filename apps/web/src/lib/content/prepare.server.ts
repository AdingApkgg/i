/**
 * 正文下发前的服务端预处理（在 loader 里调用）：
 * - 代码块用 lowlight 高亮成 HTML，公式用 KaTeX 渲染成 HTML，结果放进节点的 __html 属性；
 *   前台只做 dangerouslySetInnerHTML，不需要把高亮库和 KaTeX 的 JS 打进页面包
 * - 标题生成锚点 id，并汇总成目录
 * 返回新对象，不修改传入的文档。
 */
import { toHtml } from "hast-util-to-html";
import katex from "katex";
import { lowlight } from "./extensions";
import { plainText } from "./text";
import type { RichDoc, RichNode, TocItem } from "./types";

function slugify(text: string): string {
  return (
    text
      .trim()
      .toLowerCase()
      .replace(/[\s　]+/g, "-")
      // 保留字母数字（含中日韩文字）和连字符
      .replace(/[^\p{L}\p{N}-]+/gu, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "section"
  );
}

function highlight(code: string, language: unknown): string {
  const lang = typeof language === "string" ? language.toLowerCase() : "";
  if (lang && lowlight.registered(lang)) return toHtml(lowlight.highlight(lang, code));
  return toHtml({ type: "root", children: [{ type: "text", value: code }] });
}

function renderMath(latex: unknown, displayMode: boolean): string {
  return katex.renderToString(String(latex ?? ""), {
    displayMode,
    throwOnError: false,
    output: "html",
  });
}

export function prepareDoc(doc: RichDoc): { doc: RichDoc; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const used = new Map<string, number>();

  const walk = (node: RichNode): RichNode => {
    switch (node.type) {
      case "codeBlock": {
        const code = (node.content ?? []).map((c) => c.text ?? "").join("");
        return { ...node, attrs: { ...node.attrs, __html: highlight(code, node.attrs?.language) } };
      }
      case "inlineMath":
      case "blockMath":
        return {
          ...node,
          attrs: {
            ...node.attrs,
            __html: renderMath(node.attrs?.latex, node.type === "blockMath"),
          },
        };
      case "heading": {
        const text = plainText(node).trim();
        const base = slugify(text);
        const n = used.get(base) ?? 0;
        used.set(base, n + 1);
        const id = n ? `${base}-${n}` : base;
        const level = Number(node.attrs?.level ?? 2);
        if (text) toc.push({ id, level, text });
        return { ...node, attrs: { ...node.attrs, id }, content: node.content?.map(walk) };
      }
      default:
        return node.content ? { ...node, content: node.content.map(walk) } : node;
    }
  };

  return { doc: walk(doc) as RichDoc, toc };
}
