/**
 * 旧 Hexo（Butterfly）Markdown → Tiptap JSON，只给一次性迁移脚本和测试用。
 *
 * 路线：hexoToMdx 把 {% note %} 这类标签转成 <Note> 等 JSX → remark（gfm + mdx）解析成 mdast
 * → 逐节点映射到 lib/content/extensions.ts 的 schema。要守住 schema 的内容规则：
 * 列表项首个子节点必须是段落、行内代码不能叠加其他格式、图片是块级节点（段落里的要拆出来）、
 * 容器不能为空。认不出的 JSX / HTML 标签拆掉外壳保留内容，并记一条 warning。
 */
import type {
  Blockquote,
  Code,
  Heading,
  Image,
  List,
  ListItem,
  Nodes,
  Paragraph,
  PhrasingContent,
  Root,
  RootContent,
  Table,
} from "mdast";
import type { MdxJsxAttribute, MdxJsxFlowElement, MdxJsxTextElement } from "mdast-util-mdx-jsx";
import remarkGfm from "remark-gfm";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { hexoToMdx } from "../hexo/preprocess";
import { toEmbedSrc } from "./embed";
import type { RichDoc, RichMark, RichNode } from "./types";

type Jsx = MdxJsxFlowElement | MdxJsxTextElement;
type Item = { inline: RichNode } | { block: RichNode };

export interface ConvertResult {
  doc: RichDoc;
  warnings: string[];
  /** MDX 解析失败、改用纯 Markdown 解析（自定义标签会变成普通文本） */
  fallback: boolean;
}

const para = (content: RichNode[] = []): RichNode =>
  content.length ? { type: "paragraph", content } : { type: "paragraph" };
const nonEmpty = (blocks: RichNode[]) => (blocks.length ? blocks : [para()]);

function attrOf(el: Jsx, name: string): string {
  const a = el.attributes.find(
    (x): x is MdxJsxAttribute => x.type === "mdxJsxAttribute" && x.name === name,
  );
  if (!a || a.value == null) return "";
  return typeof a.value === "string" ? a.value : "";
}

/** mdast 里的纯文本（迁移校验用） */
export function mdastText(node: Nodes): string {
  if ("value" in node && typeof node.value === "string" && node.type !== "code") return node.value;
  if (node.type === "code") return `${node.value}\n`;
  // 图片的 alt 不算正文（转换后在 image 节点属性里，plainText 也不计）
  if (node.type === "image") return "";
  if (node.type === "break") return "\n";
  if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
    const el = node as Jsx;
    if (el.name === "Btn") return attrOf(el, "text");
    if (el.name === "HideToggle")
      return `${attrOf(el, "title")}\n${el.children.map(mdastText).join("")}`;
    if (el.name === "img") return "";
  }
  if ("children" in node) return (node.children as Nodes[]).map(mdastText).join("");
  return "";
}

class Converter {
  warnings: string[] = [];

  warn(msg: string) {
    if (!this.warnings.includes(msg)) this.warnings.push(msg);
  }

  // ---------- inline ----------

  inline(nodes: PhrasingContent[] | Nodes[], marks: RichMark[] = []): Item[] {
    const out: Item[] = [];
    for (const n of nodes as Nodes[]) out.push(...this.inlineOne(n, marks));
    return out;
  }

  text(value: string, marks: RichMark[]): Item[] {
    if (!value) return [];
    // 行内代码的 code mark 不能与其他 mark 共存
    const code = marks.find((m) => m.type === "code");
    const ms = code ? [code] : marks;
    return [
      {
        inline: ms.length
          ? { type: "text", text: value, marks: ms }
          : { type: "text", text: value },
      },
    ];
  }

  inlineOne(n: Nodes, marks: RichMark[]): Item[] {
    const add = (m: RichMark) => (marks.some((x) => x.type === m.type) ? marks : [...marks, m]);
    switch (n.type) {
      case "text":
        return this.text(n.value, marks);
      case "inlineCode":
        return this.text(n.value, [{ type: "code" }]);
      case "emphasis":
        return this.inline(n.children, add({ type: "italic" }));
      case "strong":
        return this.inline(n.children, add({ type: "bold" }));
      case "delete":
        return this.inline(n.children, add({ type: "strike" }));
      case "break":
        return [{ inline: { type: "hardBreak" } }];
      case "link":
        return this.inline(n.children, [
          ...marks.filter((m) => m.type !== "link"),
          { type: "link", attrs: { href: n.url } },
        ]);
      case "image":
        return [{ block: this.image(n.url, n.alt ?? "", n.title ?? null) }];
      case "html":
        // 只会在 MDX 解析失败后的纯 Markdown 回退里出现：丢掉标签，保留文字
        return this.text(n.value.replace(/<[^>]+>/g, ""), marks);
      case "footnoteReference":
        return this.text(`[^${n.identifier}]`, marks);
      case "mdxTextExpression":
      case "mdxFlowExpression":
        this.warn(`忽略了 MDX 表达式 {${n.value.slice(0, 20)}}`);
        return [];
      case "mdxJsxTextElement":
      case "mdxJsxFlowElement":
        return this.jsxInline(n as Jsx, marks);
      default:
        if ("children" in n) return this.inline(n.children as Nodes[], marks);
        if ("value" in n && typeof n.value === "string") return this.text(n.value, marks);
        this.warn(`忽略了行内节点 ${n.type}`);
        return [];
    }
  }

  jsxInline(el: Jsx, marks: RichMark[]): Item[] {
    const kids = el.children as Nodes[];
    const wrap = (m: RichMark) => this.inline(kids, [...marks.filter((x) => x.type !== m.type), m]);
    switch (el.name?.toLowerCase()) {
      case "btn":
        return [
          {
            inline: {
              type: "buttonLink",
              attrs: {
                href: attrOf(el, "url"),
                text: attrOf(el, "text") || "链接",
                icon: attrOf(el, "icon") || null,
                variant: attrOf(el, "variant") || null,
              },
            },
          },
        ];
      case "br":
        return [{ inline: { type: "hardBreak" } }];
      case "a":
        return attrOf(el, "href")
          ? wrap({ type: "link", attrs: { href: attrOf(el, "href") } })
          : this.inline(kids, marks);
      case "strong":
      case "b":
        return wrap({ type: "bold" });
      case "em":
      case "i":
        return wrap({ type: "italic" });
      case "u":
      case "ins":
        return wrap({ type: "underline" });
      case "del":
      case "s":
      case "strike":
        return wrap({ type: "strike" });
      case "sup":
        return wrap({ type: "superscript" });
      case "sub":
        return wrap({ type: "subscript" });
      case "mark":
        return wrap({ type: "highlight" });
      case "code":
      case "kbd":
        return this.text(mdastText(el), [{ type: "code" }]);
      case "span":
      case "font":
      case "small":
      case "big":
      case "abbr":
      case "label":
      case "ruby":
      case "rt":
      case "rp":
        return this.inline(kids, marks);
      default:
        // 块级 JSX 出现在段落里：拆成块
        return this.blocks([el as RootContent]).map((b) => ({ block: b }));
    }
  }

  /** 把一串 Item 组装成块：连续的行内内容合成段落，块原样放出 */
  assemble(items: Item[], textBlock: (c: RichNode[]) => RichNode = para): RichNode[] {
    const out: RichNode[] = [];
    let run: RichNode[] = [];
    const flush = () => {
      // 去掉首尾的换行和纯空白
      while (
        run.length &&
        (run[0]!.type === "hardBreak" || (run[0]!.type === "text" && !run[0]!.text!.trim()))
      )
        run.shift();
      while (
        run.length &&
        (run.at(-1)!.type === "hardBreak" ||
          (run.at(-1)!.type === "text" && !run.at(-1)!.text!.trim()))
      )
        run.pop();
      if (run.length) out.push(textBlock(run));
      run = [];
    };
    for (const it of items) {
      if ("inline" in it) run.push(it.inline);
      else {
        flush();
        out.push(it.block);
      }
    }
    flush();
    return out;
  }

  /** 只能放行内内容的地方（标题、表格单元格内的段落、折叠标题）：块级内容降级成文字 */
  inlineOnly(nodes: PhrasingContent[] | Nodes[]): RichNode[] {
    return this.inline(nodes).flatMap((it) =>
      "inline" in it
        ? [it.inline]
        : this.text(it.block.attrs?.alt ? String(it.block.attrs.alt) : "", []).map(
            (x) => (x as { inline: RichNode }).inline,
          ),
    );
  }

  // ---------- blocks ----------

  image(src: string, alt: string, title: string | null): RichNode {
    return { type: "image", attrs: { src, alt: alt || null, title: title || null } };
  }

  blocks(nodes: RootContent[] | Nodes[]): RichNode[] {
    const out: RichNode[] = [];
    for (const n of nodes as Nodes[]) out.push(...this.block(n));
    return out;
  }

  block(n: Nodes): RichNode[] {
    switch (n.type) {
      case "paragraph":
        return this.assemble(this.inline((n as Paragraph).children));
      case "heading": {
        const h = n as Heading;
        const items = this.inline(h.children);
        const level = Math.min(h.depth, 4);
        return this.assemble(items, (c) => ({ type: "heading", attrs: { level }, content: c }));
      }
      case "thematicBreak":
        return [{ type: "horizontalRule" }];
      case "blockquote":
        return [{ type: "blockquote", content: nonEmpty(this.blocks((n as Blockquote).children)) }];
      case "code": {
        const c = n as Code;
        return [
          {
            type: "codeBlock",
            attrs: { language: c.lang ? c.lang.toLowerCase() : null },
            ...(c.value ? { content: [{ type: "text", text: c.value }] } : {}),
          },
        ];
      }
      case "list":
        return [this.list(n as List)];
      case "table":
        return [this.table(n as Table)];
      case "html":
        return this.assemble(this.inlineOne(n, []));
      case "footnoteDefinition":
        return this.assemble([
          ...this.text(`[^${n.identifier}]: `, []),
          ...this.inline(
            n.children.flatMap((c) => ("children" in c ? (c.children as Nodes[]) : [])),
          ),
        ]);
      case "mdxjsEsm":
      case "mdxFlowExpression":
      case "definition":
      case "yaml":
        return [];
      case "mdxJsxFlowElement":
      case "mdxJsxTextElement":
        return this.jsxBlock(n as Jsx);
      default:
        if ("children" in n) return this.blocks(n.children as Nodes[]);
        this.warn(`忽略了块节点 ${n.type}`);
        return [];
    }
  }

  listItem(item: ListItem, task: boolean): RichNode {
    let content = this.blocks(item.children);
    if (content[0]?.type !== "paragraph") content = [para(), ...content];
    return task
      ? { type: "taskItem", attrs: { checked: !!item.checked }, content }
      : { type: "listItem", content };
  }

  list(l: List): RichNode {
    const task = l.children.some((i) => i.checked != null);
    const content = l.children.map((i) => this.listItem(i, task));
    if (task) return { type: "taskList", content };
    if (l.ordered) return { type: "orderedList", attrs: { start: l.start ?? 1 }, content };
    return { type: "bulletList", content };
  }

  table(t: Table): RichNode {
    return {
      type: "table",
      content: t.children.map((row, ri) => ({
        type: "tableRow",
        content: row.children.map((cell, ci) => {
          const inl = this.inlineOnly(cell.children);
          const align = t.align?.[ci];
          return {
            type: ri === 0 ? "tableHeader" : "tableCell",
            content: [
              {
                type: "paragraph",
                ...(align && align !== "left" ? { attrs: { textAlign: align } } : {}),
                ...(inl.length ? { content: inl } : {}),
              },
            ],
          };
        }),
      })),
    };
  }

  /** 收集一段 mdast / JSX 里的所有图片（图集） */
  collectImages(nodes: Nodes[]): { src: string; alt?: string }[] {
    const out: { src: string; alt?: string }[] = [];
    const visit = (n: Nodes) => {
      if (n.type === "image")
        out.push({
          src: (n as Image).url,
          ...((n as Image).alt ? { alt: (n as Image).alt! } : {}),
        });
      else if (
        (n.type === "mdxJsxFlowElement" || n.type === "mdxJsxTextElement") &&
        (n as Jsx).name === "img"
      ) {
        const src = attrOf(n as Jsx, "src");
        if (src)
          out.push({ src, ...(attrOf(n as Jsx, "alt") ? { alt: attrOf(n as Jsx, "alt") } : {}) });
      } else if ("children" in n) for (const c of n.children as Nodes[]) visit(c);
    };
    for (const n of nodes) visit(n);
    return out;
  }

  jsxBlock(el: Jsx): RichNode[] {
    const kids = el.children as Nodes[];
    const name = el.name ?? "";
    switch (name) {
      case "Note":
        return [
          {
            type: "callout",
            attrs: { color: attrOf(el, "color") || null, icon: attrOf(el, "icon") || null },
            content: nonEmpty(this.blocks(kids)),
          },
        ];
      case "HideToggle": {
        const title = attrOf(el, "title") || "详情";
        return [
          {
            type: "details",
            attrs: { color: attrOf(el, "color") || null },
            content: [
              { type: "detailsSummary", content: [{ type: "text", text: title }] },
              { type: "detailsContent", content: nonEmpty(this.blocks(kids)) },
            ],
          },
        ];
      }
      case "Tabs": {
        const tabs = kids.filter(
          (k): k is Jsx =>
            (k.type === "mdxJsxFlowElement" || k.type === "mdxJsxTextElement") &&
            (k as Jsx).name === "Tab",
        );
        if (!tabs.length) return this.blocks(kids);
        return [
          {
            type: "tabs",
            content: tabs.map((t) => ({
              type: "tab",
              attrs: { label: attrOf(t, "label") || "标签" },
              content: nonEmpty(this.blocks(t.children as Nodes[])),
            })),
          },
        ];
      }
      case "Timeline": {
        const items = kids.filter(
          (k): k is Jsx =>
            (k.type === "mdxJsxFlowElement" || k.type === "mdxJsxTextElement") &&
            (k as Jsx).name === "TimelineItem",
        );
        if (!items.length) return this.blocks(kids);
        return [
          {
            type: "timeline",
            attrs: { title: attrOf(el, "title") || null },
            content: items.map((t) => ({
              type: "timelineItem",
              attrs: { label: attrOf(t, "label") },
              content: nonEmpty(this.blocks(t.children as Nodes[])),
            })),
          },
        ];
      }
      case "Gallery": {
        const images = this.collectImages(kids);
        return images.length ? [{ type: "gallery", attrs: { images } }] : this.blocks(kids);
      }
      case "GalleryGroup":
        return [
          {
            type: "galleryCard",
            attrs: {
              name: attrOf(el, "name"),
              desc: attrOf(el, "desc") || null,
              href: attrOf(el, "url"),
              cover: attrOf(el, "cover"),
            },
          },
        ];
      case "DPlayer":
        return attrOf(el, "url")
          ? [
              {
                type: "video",
                attrs: { src: attrOf(el, "url"), poster: attrOf(el, "pic") || null },
              },
            ]
          : [];
      case "Meting":
        return [
          {
            type: "music",
            attrs: {
              server: attrOf(el, "server") || "netease",
              type: attrOf(el, "type") || "song",
              mid: attrOf(el, "mid"),
            },
          },
        ];
      case "Btn":
        return this.assemble(this.jsxInline(el, []));
    }

    switch (name.toLowerCase()) {
      case "img":
        return attrOf(el, "src")
          ? [this.image(attrOf(el, "src"), attrOf(el, "alt"), attrOf(el, "title") || null)]
          : [];
      case "iframe": {
        const raw = attrOf(el, "src");
        const src = toEmbedSrc(raw);
        if (src) return [{ type: "embed", attrs: { src, ratio: "16/9" } }];
        this.warn(`iframe 不在白名单，改成链接：${raw}`);
        return raw
          ? [para([{ type: "text", text: raw, marks: [{ type: "link", attrs: { href: raw } }] }])]
          : [];
      }
      case "video": {
        const src = attrOf(el, "src") || this.findAttr(kids, "source", "src");
        return src ? [{ type: "video", attrs: { src, poster: attrOf(el, "poster") || null } }] : [];
      }
      case "audio": {
        const src = attrOf(el, "src") || this.findAttr(kids, "source", "src");
        return src
          ? [
              para([
                { type: "text", text: "音频", marks: [{ type: "link", attrs: { href: src } }] },
              ]),
            ]
          : [];
      }
      case "hr":
        return [{ type: "horizontalRule" }];
      case "br":
        return [];
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6": {
        const level = Math.min(Number(name[1]), 4);
        return this.assemble(this.inline(kids), (c) => ({
          type: "heading",
          attrs: { level },
          content: c,
        }));
      }
      case "blockquote":
        return [{ type: "blockquote", content: nonEmpty(this.blocks(kids)) }];
      case "details": {
        const summaryEl = kids.find(
          (k): k is Jsx =>
            (k.type === "mdxJsxFlowElement" || k.type === "mdxJsxTextElement") &&
            (k as Jsx).name === "summary",
        );
        const rest = kids.filter((k) => k !== summaryEl);
        const title = summaryEl ? mdastText(summaryEl).trim() : "详情";
        return [
          {
            type: "details",
            content: [
              { type: "detailsSummary", content: title ? [{ type: "text", text: title }] : [] },
              { type: "detailsContent", content: nonEmpty(this.blocks(rest)) },
            ],
          },
        ];
      }
      case "p":
      case "div":
      case "center":
      case "section":
      case "article":
      case "figure":
      case "figcaption":
      case "span":
      case "font":
      case "table":
      case "tbody":
      case "thead":
      case "tr":
      case "td":
      case "th":
      case "ul":
      case "ol":
      case "li":
      case "summary":
        // 结构性外壳：拆壳保留内容（段落里的行内内容会被 assemble 合成段落）
        return this.assemble(
          kids.flatMap((k) =>
            this.isBlockish(k)
              ? this.block(k).map((b) => ({ block: b }) as Item)
              : this.inlineOne(k, []),
          ),
        );
      case "a":
      case "strong":
      case "b":
      case "em":
      case "i":
      case "u":
      case "del":
      case "s":
      case "sup":
      case "sub":
      case "mark":
      case "code":
      case "kbd":
      case "btn":
        return this.assemble(this.jsxInline(el, []));
      default:
        this.warn(`未知标签 <${name}>，已拆掉外壳`);
        return this.blocks(kids);
    }
  }

  isBlockish(n: Nodes): boolean {
    return [
      "paragraph",
      "heading",
      "list",
      "table",
      "code",
      "blockquote",
      "thematicBreak",
      "mdxJsxFlowElement",
    ].includes(n.type);
  }

  findAttr(nodes: Nodes[], tag: string, attr: string): string {
    for (const n of nodes) {
      if (
        (n.type === "mdxJsxFlowElement" || n.type === "mdxJsxTextElement") &&
        (n as Jsx).name === tag
      ) {
        const v = attrOf(n as Jsx, attr);
        if (v) return v;
      }
      if ("children" in n) {
        const v = this.findAttr(n.children as Nodes[], tag, attr);
        if (v) return v;
      }
    }
    return "";
  }
}

const parseMdx = (src: string) =>
  unified().use(remarkParse).use(remarkGfm).use(remarkMdx).parse(src) as Root;

/**
 * MDX 报错时，从报错位置往前找最近的 < 或 {，转义成普通文字。
 * 正文里常见的「<文件名>」「{程序/设定}」「a < b」都是这么修好的。找不到可转义的字符返回 null。
 */
function escapeAtError(src: string, err: unknown): { src: string; context: string } | null {
  const e = err as {
    line?: number;
    column?: number;
    reason?: string;
    place?: { line?: number; column?: number; start?: { line: number; column: number } };
  };
  // 「Expected a closing tag for `<文件名>` (139:21-139:26) …」：报错位置是外层段落 / 粗体的起点，
  // 出问题的标签位置写在消息里，优先用它
  const tag = /\((\d+):(\d+)-\d+:\d+\)/.exec(e.reason ?? "");
  const p = tag
    ? { line: Number(tag[1]), column: Number(tag[2]) }
    : (e.place?.start ?? (e.place?.line ? e.place : null) ?? (e.line ? e : null));
  if (!p?.line || !p.column) return null;
  const lines = src.split("\n");
  let offset = p.column - 1;
  for (let i = 0; i < p.line - 1; i++) offset += (lines[i]?.length ?? 0) + 1;
  for (let k = Math.min(offset, src.length - 1); k >= Math.max(0, offset - 400); k--) {
    const ch = src[k];
    if (ch === "<" || ch === "{") {
      const context = src.slice(Math.max(0, k - 12), k + 24).replace(/\s+/g, " ");
      return {
        src: `${src.slice(0, k)}${ch === "<" ? "&lt;" : "\\{"}${src.slice(k + 1)}`,
        context,
      };
    }
  }
  return null;
}

export function parseHexo(markdown: string): { tree: Root; fallback: boolean; escaped: string[] } {
  let mdx = hexoToMdx(markdown);
  const escaped: string[] = [];
  while (escaped.length < 100) {
    try {
      return { tree: parseMdx(mdx), fallback: false, escaped };
    } catch (err) {
      const fixed = escapeAtError(mdx, err);
      if (fixed == null) break;
      mdx = fixed.src;
      escaped.push(fixed.context);
    }
  }
  // 实在修不好：退回纯 Markdown 解析原文（Hexo 标签会变成普通文字）
  return {
    tree: unified().use(remarkParse).use(remarkGfm).parse(markdown) as Root,
    fallback: true,
    escaped: [],
  };
}

export function hexoToDoc(markdown: string): ConvertResult {
  const { tree, fallback, escaped } = parseHexo(markdown);
  const c = new Converter();
  if (fallback) c.warn("MDX 解析失败，按纯 Markdown 转换（Hexo 标签会变成普通文字）");
  for (const ctx of escaped) c.warn(`转义：…${ctx}…`);
  const doc: RichDoc = { type: "doc", content: nonEmpty(c.blocks(tree.children)) };
  return { doc, warnings: c.warnings, fallback };
}
