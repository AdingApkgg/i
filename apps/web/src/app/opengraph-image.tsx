import { siteConfig } from "@i/config";
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

// 运行时渲染：中文字体按需拉取，构建期不一定有网
export const dynamic = "force-dynamic";
export const alt = `${siteConfig.title} · 个人空间`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({ eyebrow: "个人空间", title: siteConfig.tagline });
}
