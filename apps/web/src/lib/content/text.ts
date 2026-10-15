import type { RichNode } from "./types";

/** 块级节点之间换行，行内拼接；用于摘要、字数和迁移校验 */
const INLINE_ATOMS: Record<string, (n: RichNode) => string> = {
  hardBreak: () => "\n",
  buttonLink: (n) => String(n.attrs?.text ?? ""),
  inlineMath: (n) => String(n.attrs?.latex ?? ""),
};

export function plainText(node: RichNode | null | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.text ?? "";
  const atom = INLINE_ATOMS[node.type];
  if (atom) return atom(node);
  if (node.type === "blockMath") return `${node.attrs?.latex ?? ""}\n`;
  const inner = (node.content ?? []).map(plainText).join("");
  const isTextBlock = (node.content ?? []).some((c) => c.type === "text" || c.type in INLINE_ATOMS);
  return isTextBlock ? `${inner}\n` : inner;
}

/** 由正文生成摘要：去掉多余空白后截断 */
export function excerptOf(node: RichNode | null | undefined, max = 140): string {
  const s = plainText(node).replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max).trimEnd()}…` : s;
}
