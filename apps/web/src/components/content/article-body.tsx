import katexCss from "katex/dist/katex.min.css?url";
import type { ArticleBodyData } from "@/lib/content/load.server";
import { HexoContent } from "./legacy-markdown";
import { RichContent } from "./rich-content";

/** 正文：富文本（迁移后）或旧 Markdown（迁移前）。有公式时才加载 KaTeX 样式 */
export function ArticleBody({ body, className }: { body: ArticleBodyData; className?: string }) {
  if (body.kind === "legacy")
    return <HexoContent code={body.code} source={body.source} className={className} />;
  return (
    <>
      {/* React 19 会把带 precedence 的样式表提升到 <head>，并去重 */}
      {body.hasMath && <link rel="stylesheet" href={katexCss} precedence="default" />}
      <RichContent doc={body.doc} className={className} />
    </>
  );
}
