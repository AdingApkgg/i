import { compileMDX } from "next-mdx-remote/rsc";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { hexoToMdx } from "@/lib/hexo/preprocess";
import { Btn } from "./btn";
import { DPlayer } from "./dplayer";
import { Gallery } from "./gallery";
import { GalleryGroup } from "./gallery-group";
import { HideToggle } from "./hide-toggle";
import { Meting } from "./meting";
import { Note } from "./note";
import { Tab, Tabs } from "./tabs";
import { Timeline, TimelineItem } from "./timeline";

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
  // give raw <img> in content lazy loading + rounded corners
  img: (p: React.ImgHTMLAttributes<HTMLImageElement>) => (
    // biome-ignore lint/a11y/useAltText: passthrough
    <img {...p} loading="lazy" className="rounded-[var(--radius-md)]" />
  ),
};

/**
 * Render imported Hexo markdown: preprocess Butterfly tags → MDX, compile with
 * our component map. If MDX compilation fails on a quirky post, fall back to
 * plain react-markdown so the post still renders (minus the fancy tags).
 */
export async function HexoContent({ source, className }: { source: string; className?: string }) {
  const mdx = hexoToMdx(source);
  try {
    const { content } = await compileMDX({
      source: mdx,
      components,
      options: { parseFrontmatter: false, mdxOptions: { remarkPlugins: [remarkGfm] } },
    });
    return <div className={className}>{content}</div>;
  } catch {
    return (
      <div className={className}>
        <Markdown remarkPlugins={[remarkGfm]}>{source}</Markdown>
      </div>
    );
  }
}
