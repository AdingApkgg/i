/**
 * 正文的自定义节点（对应旧 Hexo / Butterfly 标签，也是编辑器里「/」能插入的块）。
 * 这里只定义 schema（属性、内容模型、HTML 往返），不含任何 React：
 * 后台编辑器在此基础上 extend 出 NodeView，前台渲染见 components/content/rich-content.tsx。
 *
 * 所有属性都以 data-* 写进 HTML，复制粘贴、拖拽在编辑器之间往返不丢信息。
 */
import { mergeAttributes, Node } from "@tiptap/core";

/** 读写一个 data-* 属性；空字符串 / null 不写出 */
function dataAttr(name: string, fallback: string | null = null) {
  return {
    default: fallback,
    parseHTML: (el: HTMLElement) => el.getAttribute(`data-${name}`) ?? fallback,
    renderHTML: (attrs: Record<string, unknown>) =>
      attrs[name] == null || attrs[name] === "" ? {} : { [`data-${name}`]: String(attrs[name]) },
  };
}

/** 读写一个 JSON 数组属性（图集图片列表） */
function jsonAttr(name: string) {
  return {
    default: [],
    parseHTML: (el: HTMLElement) => {
      try {
        const v = JSON.parse(el.getAttribute(`data-${name}`) ?? "[]");
        return Array.isArray(v) ? v : [];
      } catch {
        return [];
      }
    },
    renderHTML: (attrs: Record<string, unknown>) => ({
      [`data-${name}`]: JSON.stringify(attrs[name] ?? []),
    }),
  };
}

/** 提示框（Hexo note）：左侧色条 + 图标，内容是任意块 */
export const Callout = Node.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  addAttributes: () => ({ color: dataAttr("color"), icon: dataAttr("icon") }),
  parseHTML: () => [{ tag: 'div[data-type="callout"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-type": "callout" }),
    0,
  ],
});

/** 标签页容器（Hexo tabs），只能装 tab */
export const Tabs = Node.create({
  name: "tabs",
  group: "block",
  content: "tab+",
  defining: true,
  isolating: true,
  parseHTML: () => [{ tag: 'div[data-type="tabs"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-type": "tabs" }),
    0,
  ],
});

export const Tab = Node.create({
  name: "tab",
  content: "block+",
  defining: true,
  isolating: true,
  addAttributes: () => ({ label: dataAttr("label", "标签") }),
  parseHTML: () => [{ tag: 'div[data-type="tab"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-type": "tab" }),
    0,
  ],
});

/** 时间轴（Hexo timeline） */
export const Timeline = Node.create({
  name: "timeline",
  group: "block",
  content: "timelineItem+",
  defining: true,
  isolating: true,
  addAttributes: () => ({ title: dataAttr("title") }),
  parseHTML: () => [{ tag: 'div[data-type="timeline"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-type": "timeline" }),
    0,
  ],
});

export const TimelineItem = Node.create({
  name: "timelineItem",
  content: "block+",
  defining: true,
  isolating: true,
  addAttributes: () => ({ label: dataAttr("label", "") }),
  parseHTML: () => [{ tag: 'div[data-type="timeline-item"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-type": "timeline-item" }),
    0,
  ],
});

/** 行内按钮链接（Hexo btn）。variant：空格分隔的颜色词 + block */
export const ButtonLink = Node.create({
  name: "buttonLink",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes: () => ({
    href: dataAttr("href", ""),
    text: dataAttr("text", "按钮"),
    icon: dataAttr("icon"),
    variant: dataAttr("variant"),
  }),
  parseHTML: () => [{ tag: 'a[data-type="button-link"]' }],
  renderHTML: ({ HTMLAttributes, node }) => [
    "a",
    mergeAttributes(HTMLAttributes, { "data-type": "button-link", href: node.attrs.href }),
    node.attrs.text,
  ],
});

export interface GalleryImage {
  src: string;
  alt?: string;
}

/** 图集（Hexo gallery）：瀑布流图片墙，图片列表存在属性里 */
export const Gallery = Node.create({
  name: "gallery",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes: () => ({ images: jsonAttr("images") }),
  parseHTML: () => [{ tag: 'div[data-type="gallery"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-type": "gallery" }),
  ],
});

/** 图集卡片（Hexo galleryGroup）：封面 + 名称 + 描述，点击跳转 */
export const GalleryCard = Node.create({
  name: "galleryCard",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes: () => ({
    name: dataAttr("name", ""),
    desc: dataAttr("desc"),
    href: dataAttr("href", ""),
    cover: dataAttr("cover", ""),
  }),
  parseHTML: () => [{ tag: 'div[data-type="gallery-card"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-type": "gallery-card" }),
  ],
});

/** 视频（Hexo dplayer）：mp4 / m3u8，点击封面才加载 */
export const Video = Node.create({
  name: "video",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes: () => ({ src: dataAttr("src", ""), poster: dataAttr("poster") }),
  parseHTML: () => [{ tag: 'div[data-type="video"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-type": "video" }),
  ],
});

/** 音乐（meting）：单曲是一行可点击的歌曲，歌单 / 专辑是播放按钮，都交给全站播放器 */
export const Music = Node.create({
  name: "music",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes: () => ({
    server: dataAttr("server", "netease"),
    type: dataAttr("type", "song"),
    mid: dataAttr("mid", ""),
  }),
  parseHTML: () => [{ tag: 'div[data-type="music"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-type": "music" }),
  ],
});

/** 外部嵌入（iframe）：B 站、YouTube 等，src 只允许白名单域名（见 lib/content/embed.ts） */
export const Embed = Node.create({
  name: "embed",
  group: "block",
  atom: true,
  draggable: true,
  addAttributes: () => ({ src: dataAttr("src", ""), ratio: dataAttr("ratio", "16/9") }),
  parseHTML: () => [{ tag: 'div[data-type="embed"]' }],
  renderHTML: ({ HTMLAttributes }) => [
    "div",
    mergeAttributes(HTMLAttributes, { "data-type": "embed" }),
  ],
});
