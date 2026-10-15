import { type ComponentType, useMemo } from "react";
import * as runtime from "react/jsx-runtime";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

// biome-ignore lint/suspicious/noExplicitAny: MDX component map is loosely typed
const components: Record<string, any> = {
  Note,
  HideToggle,
  Tabs,
  Tab,
  Btn,
  Timeline,
  TimelineItem,
  Gallery,
  GalleryGroup,
  DPlayer,
  Meting,
  // give raw <img> in content lazy loading + rounded corners；站内存储的图按正文宽度（max-w-2xl）取缩放版
  img: (p: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // biome-ignore lint/a11y/useAltText: passthrough
    <img
      {...p}
      {...(typeof p.src === "string"
        ? thumbProps(p.src, [640, 960, 1280, 1920], "(min-width: 704px) 672px, 100vw")
        : {})}
      loading="lazy"
      className="rounded-[var(--radius-md)]"
    />
  ),
};

type MdxContent = ComponentType<{ components?: Record<string, unknown> }>;

/**
 * 执行 compileHexo（lib/hexo/compile.server.ts）产出的 MDX 函数体。
 * 等价于 @mdx-js/mdx 的 runSync，但不把 MDX 编译器打进浏览器包。
 * 代码来自后台自己的文章内容，和原先在服务端编译执行是同一信任边界。
 */
function runMdx(code: string): MdxContent {
  const fn = new Function(code) as (rt: typeof runtime & { baseUrl: string }) => {
    default: MdxContent;
  };
  return fn({ ...runtime, baseUrl: "/" }).default;
}

/**
 * 渲染导入的 Hexo markdown：loader 里已把 Butterfly 标签预处理并编译成 MDX（code），
 * 这里配上组件表渲染。编译失败的文章（code 为 null）回退为纯 react-markdown，
 * 至少保证正文可读（少了那些花哨标签）。
 */
export function HexoContent({
  code,
  source,
  className,
}: {
  code: string | null;
  source: string;
  className?: string;
}) {
  const Content = useMemo(() => (code ? runMdx(code) : null), [code]);
  return (
    <div className={className}>
      {Content ? (
        <Content components={components} />
      ) : (
        <Markdown remarkPlugins={[remarkGfm]}>{source}</Markdown>
      )}
    </div>
  );
}
