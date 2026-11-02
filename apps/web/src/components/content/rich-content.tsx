/**
 * 前台正文渲染：把 Tiptap JSON 直接映射成 React 元素。
 * 不依赖 Tiptap / ProseMirror（页面包里没有编辑器），代码高亮和公式已在 loader 里
 * 由 lib/content/prepare.server.ts 渲染成 HTML（__html）。
 * 认不出的节点只渲染子节点，不会整篇报错。
 */
import { Check } from "lucide-react";
import { type CSSProperties, createElement, Fragment, type ReactNode } from "react";
import { safeHref, toEmbedSrc } from "@/lib/content/embed";
import type { RichMark, RichNode } from "@/lib/content/types";
import { thumbProps } from "@/lib/thumb";
import { Btn } from "./blocks/btn";
import { DPlayer } from "./blocks/dplayer";
import { Gallery } from "./blocks/gallery";
import { GalleryGroup } from "./blocks/gallery-group";
import { HideToggle } from "./blocks/hide-toggle";
import { Meting } from "./blocks/meting";
import { Note } from "./blocks/note";
import { Tab, Tabs } from "./blocks/tabs";
import { Timeline, TimelineItem } from "./blocks/timeline";

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);

function alignStyle(node: RichNode): CSSProperties | undefined {
  const a = str(node.attrs?.textAlign);
  return a && a !== "left" ? { textAlign: a as CSSProperties["textAlign"] } : undefined;
}

function renderMark(mark: RichMark, child: ReactNode, key: number): ReactNode {
  const a = mark.attrs ?? {};
  switch (mark.type) {
    case "bold":
      return <strong key={key}>{child}</strong>;
    case "italic":
      return <em key={key}>{child}</em>;
    case "underline":
      return <u key={key}>{child}</u>;
    case "strike":
      return <s key={key}>{child}</s>;
    case "code":
      return <code key={key}>{child}</code>;
    case "subscript":
      return <sub key={key}>{child}</sub>;
    case "superscript":
      return <sup key={key}>{child}</sup>;
    case "highlight":
      return (
        <mark key={key} style={str(a.color) ? { backgroundColor: str(a.color) } : undefined}>
          {child}
        </mark>
      );
    case "textStyle":
      return str(a.color) ? (
        <span key={key} style={{ color: str(a.color) }}>
          {child}
        </span>
      ) : (
        child
      );
    case "link": {
      const href = safeHref(a.href);
      const external = href ? /^https?:/i.test(href) : false;
      return (
        <a
          key={key}
          href={href}
          target={external ? "_blank" : undefined}
          rel={external ? "noopener noreferrer" : undefined}
        >
          {child}
        </a>
      );
    }
    default:
      return child;
  }
}

function renderText(node: RichNode, key: number): ReactNode {
  let out: ReactNode = node.text ?? "";
  // marks 数组里先出现的包在最外层
  const marks = node.marks ?? [];
  for (let i = marks.length - 1; i >= 0; i--) out = renderMark(marks[i]!, out, i);
  return <Fragment key={key}>{out}</Fragment>;
}

const children = (node: RichNode) => node.content?.map((c, i) => renderNode(c, i));

function renderNode(node: RichNode, key: number): ReactNode {
  const a = node.attrs ?? {};
  switch (node.type) {
    case "text":
      return renderText(node, key);
    case "paragraph":
      return (
        <p key={key} style={alignStyle(node)}>
          {children(node)}
        </p>
      );
    case "heading": {
      const level = Math.min(Math.max(Number(a.level) || 2, 1), 4);
      return createElement(
        `h${level}`,
        { key, id: str(a.id), style: alignStyle(node) },
        children(node),
      );
    }
    case "hardBreak":
      return <br key={key} />;
    case "horizontalRule":
      return <hr key={key} />;
    case "blockquote":
      return <blockquote key={key}>{children(node)}</blockquote>;
    case "bulletList":
      return <ul key={key}>{children(node)}</ul>;
    case "orderedList":
      return (
        <ol key={key} start={Number(a.start) > 1 ? Number(a.start) : undefined}>
          {children(node)}
        </ol>
      );
    case "listItem":
      return <li key={key}>{children(node)}</li>;
    case "taskList":
      return (
        <ul key={key} className="not-prose my-3 space-y-1.5 pl-0">
          {children(node)}
        </ul>
      );
    case "taskItem":
      return (
        <li key={key} className="flex list-none items-start gap-2">
          <span
            aria-hidden
            className={`mt-1 inline-flex size-4 shrink-0 items-center justify-center rounded border ${a.checked ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
          >
            {a.checked ? <Check className="size-3" /> : null}
          </span>
          <div className="min-w-0 flex-1 [&>p]:my-0">{children(node)}</div>
        </li>
      );
    case "codeBlock":
      return (
        <pre key={key} data-language={str(a.language)}>
          <code
            className={str(a.language) ? `hljs language-${str(a.language)}` : "hljs"}
            // 由 lowlight 在服务端生成（文本已转义），见 prepare.server.ts
            // biome-ignore lint/security/noDangerouslySetInnerHtml: 服务端生成的高亮 HTML
            dangerouslySetInnerHTML={{ __html: String(a.__html ?? "") }}
          />
        </pre>
      );
    case "inlineMath":
      return (
        <span
          key={key}
          className="math-inline"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: 服务端 KaTeX 输出
          dangerouslySetInnerHTML={{ __html: String(a.__html ?? "") }}
        />
      );
    case "blockMath":
      return (
        <div
          key={key}
          className="math-block my-4 overflow-x-auto"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: 服务端 KaTeX 输出
          dangerouslySetInnerHTML={{ __html: String(a.__html ?? "") }}
        />
      );
    case "image": {
      const src = str(a.src);
      if (!src) return null;
      const align = str(a.align);
      return (
        <figure
          key={key}
          className="my-5"
          style={{
            width: str(a.width),
            marginInline: align === "left" ? "0 auto" : align === "right" ? "auto 0" : "auto",
          }}
        >
          <img
            alt={str(a.alt) ?? ""}
            {...thumbProps(src, [640, 960, 1280, 1920], "(min-width: 704px) 672px, 100vw")}
            loading="lazy"
            className="mx-auto rounded-[var(--radius-md)]"
          />
          {str(a.title) && (
            <figcaption className="mt-2 text-center text-sm text-muted-foreground">
              {str(a.title)}
            </figcaption>
          )}
        </figure>
      );
    }
    case "table":
      return (
        <div key={key} className="my-5 overflow-x-auto">
          <table>
            <tbody>{children(node)}</tbody>
          </table>
        </div>
      );
    case "tableRow":
      return <tr key={key}>{children(node)}</tr>;
    case "tableHeader":
    case "tableCell":
      return createElement(
        node.type === "tableHeader" ? "th" : "td",
        {
          key,
          colSpan: Number(a.colspan) > 1 ? Number(a.colspan) : undefined,
          rowSpan: Number(a.rowspan) > 1 ? Number(a.rowspan) : undefined,
        },
        children(node),
      );
    case "details": {
      const summary = node.content?.find((c) => c.type === "detailsSummary");
      const body = node.content?.find((c) => c.type === "detailsContent");
      return (
        <HideToggle key={key} title={summary ? children(summary) : "详情"} color={str(a.color)}>
          {body ? children(body) : null}
        </HideToggle>
      );
    }
    case "callout":
      return (
        <Note key={key} color={str(a.color)} icon={str(a.icon)}>
          {children(node)}
        </Note>
      );
    case "tabs":
      return (
        <Tabs key={key}>
          {node.content?.map((tab, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 静态正文，顺序不变
            <Tab key={i} label={str(tab.attrs?.label) ?? `标签 ${i + 1}`}>
              {children(tab)}
            </Tab>
          ))}
        </Tabs>
      );
    case "timeline":
      return (
        <Timeline key={key} title={str(a.title)}>
          {node.content?.map((item, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 静态正文，顺序不变
            <TimelineItem key={i} label={str(item.attrs?.label) ?? ""}>
              {children(item)}
            </TimelineItem>
          ))}
        </Timeline>
      );
    case "buttonLink":
      return (
        <Btn
          key={key}
          url={safeHref(a.href) ?? "#"}
          text={str(a.text) ?? ""}
          icon={str(a.icon)}
          variant={str(a.variant)}
        />
      );
    case "gallery": {
      const images = Array.isArray(a.images) ? (a.images as { src?: string; alt?: string }[]) : [];
      return (
        <Gallery key={key}>
          {images
            .filter((im) => str(im.src))
            .map((im, i) => (
              <img
                // biome-ignore lint/suspicious/noArrayIndexKey: 静态正文，同一张图可能出现两次
                key={i}
                alt={im.alt ?? ""}
                {...thumbProps(im.src!, [320, 640, 960], "(min-width: 768px) 224px, 50vw")}
                loading="lazy"
              />
            ))}
        </Gallery>
      );
    }
    case "galleryCard":
      return (
        <div key={key} className="my-4">
          <GalleryGroup
            name={str(a.name) ?? ""}
            desc={str(a.desc)}
            url={safeHref(a.href) ?? "#"}
            cover={str(a.cover) ?? ""}
          />
        </div>
      );
    case "video":
      return str(a.src) ? <DPlayer key={key} url={str(a.src)!} pic={str(a.poster)} /> : null;
    case "music":
      return <Meting key={key} server={str(a.server)} type={str(a.type)} mid={str(a.mid)} />;
    case "embed": {
      const src = toEmbedSrc(String(a.src ?? ""));
      if (!src) return null;
      return (
        <div
          key={key}
          className="my-5 overflow-hidden rounded-[var(--radius-md)] bg-muted"
          style={{ aspectRatio: str(a.ratio) ?? "16/9" }}
        >
          <iframe
            src={src}
            title="嵌入内容"
            className="size-full"
            loading="lazy"
            allow="fullscreen; picture-in-picture; encrypted-media"
            sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      );
    }
    default:
      return node.content ? <Fragment key={key}>{children(node)}</Fragment> : null;
  }
}

export function RichContent({ doc, className }: { doc: RichNode; className?: string }) {
  return <div className={className}>{children(doc)}</div>;
}
