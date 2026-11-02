/** 独立下载格式：JSON 保留原始数据；HTML 不加载编辑器或站点 JavaScript。 */
import katex from "katex";
import { createElement, Fragment, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { toEmbedSrc } from "./embed";
import { prepareDoc } from "./prepare.server";
import type { RichDoc, RichMark, RichNode } from "./types";

export function backupJson(posts: unknown[], pages: unknown[], siteUrl: string): string {
  return JSON.stringify(
    {
      format: "i-content-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      siteUrl,
      posts,
      pages,
    },
    null,
    2,
  );
}

interface Article {
  title: string;
  content?: unknown;
  contentMd?: string | null;
  tags?: string[] | null;
  updatedAt?: Date;
}

const text = (value: unknown) => (typeof value === "string" ? value : "");
const CSS = `
:root{color-scheme:light dark;font-family:system-ui,sans-serif;line-height:1.8}body{max-width:800px;margin:40px auto;padding:0 20px;overflow-wrap:anywhere}a{color:#da478c}header,footer{border-bottom:1px solid #aaa6;margin-bottom:2em;padding-bottom:1em}footer{border-top:1px solid #aaa6;border-bottom:0;margin-top:3em;font-size:.85em}h1,h2,h3,h4{line-height:1.4}img,video{max-width:100%;height:auto}figure{margin:1.5em 0}figcaption,.meta{font-size:.85em;opacity:.75}pre{overflow-x:auto;padding:1em;background:#8881;border-radius:8px;white-space:pre}code{font-family:ui-monospace,monospace}p code{background:#8882;padding:.1em .3em}blockquote,.callout{border-left:3px solid #ee6ab2;margin:1em 0;padding:.2em 1em;background:#ee6ab211}table{border-collapse:collapse;width:100%}td,th{border:1px solid #aaa6;padding:.4em .7em}.table{overflow-x:auto}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(180px,100%),1fr));gap:12px}.tab,.timeline-item{border:1px solid #aaa6;border-radius:8px;padding:0 1em;margin:1em 0}details{border:1px solid #aaa6;border-radius:8px;padding:.5em 1em}summary{cursor:pointer;font-weight:600}math[display=block]{display:block;overflow-x:auto;margin:1em 0}.hljs-keyword,.hljs-selector-tag{color:#b858c0}.hljs-string,.hljs-attr{color:#639839}.hljs-number,.hljs-literal{color:#c57834}.hljs-comment{color:#888}@media print{body{max-width:none;margin:0}details{display:block}a{color:inherit}}
`;

export function exportHtml(article: Article, path: string, origin: string): string {
  const permalink = new URL(path, origin).href;
  // 单独打开下载文件时，站内链接仍指回原站；只允许显式安全的协议。
  const url = (value: unknown, media = false): string | undefined => {
    const raw = text(value).trim();
    if (!raw) return undefined;
    if (!media && raw.startsWith("#")) return raw;
    try {
      const parsed = new URL(raw, permalink);
      return (media ? ["http:", "https:"] : ["http:", "https:", "mailto:"]).includes(
        parsed.protocol,
      )
        ? parsed.href
        : undefined;
    } catch {
      return undefined;
    }
  };
  const marked = (mark: RichMark, child: ReactNode): ReactNode => {
    const a = mark.attrs ?? {};
    const tag = (
      {
        bold: "strong",
        italic: "em",
        underline: "u",
        strike: "s",
        code: "code",
        subscript: "sub",
        superscript: "sup",
      } as Record<string, string>
    )[mark.type];
    if (tag) return createElement(tag, null, child);
    if (mark.type === "link") return <a href={url(a.href)}>{child}</a>;
    if (mark.type === "highlight")
      return <mark style={{ backgroundColor: text(a.color) || undefined }}>{child}</mark>;
    if (mark.type === "textStyle")
      return <span style={{ color: text(a.color) || undefined }}>{child}</span>;
    return child;
  };
  const kids = (node: RichNode): ReactNode =>
    node.content?.map((n, i) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: 一次性静态 HTML，无客户端状态或重排
      <Fragment key={i}>{render(n)}</Fragment>
    ));
  const image = (src: unknown, alt: unknown, caption?: unknown): ReactNode => {
    const safe = url(src, true);
    return safe ? (
      <figure>
        <img src={safe} alt={text(alt)} />
        {caption ? <figcaption>{text(caption)}</figcaption> : null}
      </figure>
    ) : null;
  };
  const render = (node: RichNode): ReactNode => {
    const a = node.attrs ?? {};
    switch (node.type) {
      case "text":
        return (node.marks ?? []).reduceRight<ReactNode>(
          (out, mark) => marked(mark, out),
          node.text ?? "",
        );
      case "paragraph":
        return (
          <p
            style={{
              textAlign: ["left", "center", "right", "justify"].includes(text(a.textAlign))
                ? (a.textAlign as "left")
                : undefined,
            }}
          >
            {kids(node)}
          </p>
        );
      case "heading":
        return createElement(
          `h${Math.min(Math.max(Number(a.level) || 2, 1), 4)}`,
          { id: text(a.id) || undefined },
          kids(node),
        );
      case "hardBreak":
        return <br />;
      case "horizontalRule":
        return <hr />;
      case "blockquote":
        return <blockquote>{kids(node)}</blockquote>;
      case "bulletList":
      case "taskList":
        return <ul>{kids(node)}</ul>;
      case "orderedList":
        return <ol start={Number(a.start) || 1}>{kids(node)}</ol>;
      case "listItem":
        return <li>{kids(node)}</li>;
      case "taskItem":
        return (
          <li>
            <input
              type="checkbox"
              disabled
              checked={a.checked === true}
              aria-label={a.checked ? "已完成" : "未完成"}
            />
            {kids(node)}
          </li>
        );
      case "codeBlock":
        return (
          <pre>
            <code
              className="hljs"
              // biome-ignore lint/security/noDangerouslySetInnerHtml: prepareDoc 从代码文本重新生成并转义
              dangerouslySetInnerHTML={{ __html: text(a.__html) }}
            />
          </pre>
        );
      case "inlineMath":
      case "blockMath": {
        const html = katex.renderToString(text(a.latex), {
          output: "mathml",
          displayMode: node.type === "blockMath",
          throwOnError: false,
        });
        return createElement(node.type === "blockMath" ? "div" : "span", {
          // biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX 生成的 MathML，未启用 trust
          dangerouslySetInnerHTML: { __html: html },
        });
      }
      case "image":
        return image(a.src, a.alt, a.title);
      case "table":
        return (
          <div className="table">
            <table>
              <tbody>{kids(node)}</tbody>
            </table>
          </div>
        );
      case "tableRow":
        return <tr>{kids(node)}</tr>;
      case "tableHeader":
      case "tableCell":
        return createElement(
          node.type === "tableHeader" ? "th" : "td",
          { colSpan: Number(a.colspan) || 1, rowSpan: Number(a.rowspan) || 1 },
          kids(node),
        );
      case "details":
        return <details open>{kids(node)}</details>;
      case "detailsSummary":
        return <summary>{kids(node)}</summary>;
      case "detailsContent":
        return <div>{kids(node)}</div>;
      case "callout":
        return <aside className="callout">{kids(node)}</aside>;
      // 导出所有标签，不能沿用只显示 active tab 的交互组件。
      case "tabs":
        return <section>{kids(node)}</section>;
      case "tab":
        return (
          <section className="tab">
            <h3>{text(a.label) || "标签"}</h3>
            {kids(node)}
          </section>
        );
      case "timeline":
        return (
          <section>
            <h3>{text(a.title)}</h3>
            {kids(node)}
          </section>
        );
      case "timelineItem":
        return (
          <section className="timeline-item">
            <h4>{text(a.label)}</h4>
            {kids(node)}
          </section>
        );
      case "buttonLink":
        return <a href={url(a.href)}>{text(a.text)}</a>;
      case "gallery":
        return (
          <div className="gallery">
            {Array.isArray(a.images)
              ? a.images.map((im, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: 一次性静态 HTML，图片允许重复
                  <Fragment key={i}>{image(im?.src, im?.alt)}</Fragment>
                ))
              : null}
          </div>
        );
      case "galleryCard":
        return (
          <section>
            <a href={url(a.href)}>
              {image(a.cover, a.name)}
              {text(a.name)}
            </a>
            <p>{text(a.desc)}</p>
          </section>
        );
      case "video": {
        const src = url(a.src, true);
        return src ? (
          <figure>
            <video controls preload="none" src={src} poster={url(a.poster, true)}>
              <track kind="captions" />
            </video>
            <figcaption>
              <a href={src}>打开视频来源</a>
            </figcaption>
          </figure>
        ) : null;
      }
      case "music": {
        const server = text(a.server) || "netease",
          type = text(a.type) || "song",
          mid = text(a.mid);
        const href =
          server === "netease" && ["song", "playlist", "album", "artist"].includes(type)
            ? `https://music.163.com/#/${type}?id=${encodeURIComponent(mid)}`
            : undefined;
        return (
          <p>
            音乐：
            <a href={href ?? permalink}>
              {server} · {type} · {mid}
              {href ? "" : "（回原站播放）"}
            </a>
          </p>
        );
      }
      case "embed": {
        const src = toEmbedSrc(text(a.src));
        return src ? (
          <p>
            嵌入内容：<a href={src}>{src}</a>
          </p>
        ) : null;
      }
      default:
        return kids(node);
    }
  };
  // prepareDoc 会重新生成高亮 HTML，绝不信任存储节点中的 __html。
  const doc = article.content ? prepareDoc(article.content as RichDoc).doc : null;
  return `<!doctype html>\n${renderToStaticMarkup(
    <html lang="zh-CN">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'none'; img-src https: http:; media-src https: http:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
        />
        <title>{article.title}</title>
        <style>{CSS}</style>
      </head>
      <body>
        <header>
          <h1>{article.title}</h1>
          <p className="meta">
            <a href={permalink}>原文链接</a>
            {article.updatedAt ? ` · 更新于 ${article.updatedAt.toISOString()}` : ""}
          </p>
          {article.tags?.length ? <p>{article.tags.join(" · ")}</p> : null}
        </header>
        <article>{doc ? kids(doc) : <pre>{article.contentMd ?? ""}</pre>}</article>
        <footer>
          此文件导出已保存的正文。图片、音视频保留在线来源，不包含媒体文件；音乐及嵌入内容通过链接访问。
        </footer>
      </body>
    </html>,
  )}`;
}
