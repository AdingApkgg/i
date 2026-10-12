import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { siteConfig } from "@i/config";
import { siteUrl } from "@/lib/site-url";

/**
 * 分享卡片：樱粉底 + 白卡片 + 大标题，1200×630 PNG。
 * satori 把 JSX 排版成 SVG，resvg（WASM）光栅化成 PNG —— 即 next/og 内部的做法。
 * 两者都在第一次出图时才加载，渲染出问题也不影响站点启动。
 */
export const OG_SIZE = { width: 1200, height: 630 };

const require = createRequire(import.meta.url);

/** 拉丁文兜底字体（@fontsource 的 woff，satori 不认 woff2） */
let latinFont: Promise<Buffer> | undefined;
const loadLatinFont = () =>
  (latinFont ??= readFile(
    require.resolve("@fontsource/noto-sans/files/noto-sans-latin-700-normal.woff"),
  ));

let resvgReady: Promise<typeof import("@resvg/resvg-wasm")> | undefined;
const loadResvg = () =>
  (resvgReady ??= (async () => {
    const mod = await import("@resvg/resvg-wasm");
    await mod.initWasm(await readFile(require.resolve("@resvg/resvg-wasm/index_bg.wasm")));
    return mod;
  })());

// globals.css 主题色（oklch → sRGB），satori 不认 CSS 变量
const C = {
  bg: "#fffcfe",
  fg: "#281e25",
  muted: "#75626e",
  primary: "#f072b3",
  soft: "#ffeaf5",
  accent: "#fee2f1",
  border: "#ece1e7",
};

const FONT_FAMILY = "Noto Sans SC";
const fontCache = new Map<string, ArrayBuffer>();

/**
 * 按需子集化拉 Noto Sans SC（Google Fonts `text=` 只返回用到的字形，几 KB）。
 * 内置字体没有中文字形；拉不到就返回 null，由调用方降级成纯拉丁文卡片。
 */
async function loadFont(text: string): Promise<ArrayBuffer | null> {
  const chars = [...new Set(text)].sort().join("");
  const hit = fontCache.get(chars);
  if (hit) return hit;
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=${encodeURIComponent(FONT_FAMILY)}:wght@700&text=${encodeURIComponent(chars)}`,
      { signal: AbortSignal.timeout(4000) },
    ).then((r) => (r.ok ? r.text() : ""));
    const src = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!src) return null;
    const res = await fetch(src, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (fontCache.size > 200) fontCache.clear();
    fontCache.set(chars, buf);
    return buf;
  } catch {
    return null;
  }
}

export interface OgCard {
  /** 小标题，如「博客」 */
  eyebrow?: string;
  title: string;
  /** 标题下一行，如日期 / 标签 */
  meta?: string;
}

export async function renderOgImage(card: OgCard): Promise<Response> {
  const host = new URL(siteUrl()).host;
  const brand = `${siteConfig.title}${card.eyebrow ? ` · ${card.eyebrow}` : ""}`;
  const font = await loadFont(`${brand}${card.title}${card.meta ?? ""}${host}${siteConfig.name}`);
  // 拿不到中文字体：只画拉丁文，避免整张图变豆腐块
  const c: OgCard & { brand: string } = font
    ? { ...card, brand }
    : { title: siteConfig.title, brand: siteConfig.handle };
  const titleSize = c.title.length > 40 ? 52 : c.title.length > 20 ? 64 : 76;

  const [{ default: satori }, latin, { Resvg }] = await Promise.all([
    import("satori"),
    loadLatinFont(),
    loadResvg(),
  ]);
  const svg = await satori(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        padding: 56,
        background: `linear-gradient(135deg, ${C.soft} 0%, ${C.bg} 55%, ${C.accent} 100%)`,
        fontFamily: font ? `${FONT_FAMILY}, Noto Sans` : "Noto Sans",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          borderRadius: 40,
          background: "#ffffff",
          border: `2px solid ${C.border}`,
          boxShadow: "0 20px 60px rgba(240, 114, 179, 0.18)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 18, height: 18, borderRadius: 999, background: C.primary }} />
          <div style={{ fontSize: 30, color: C.primary, fontWeight: 700 }}>{c.brand}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: titleSize,
              fontWeight: 700,
              color: C.fg,
              lineHeight: 1.25,
              lineClamp: 3,
              display: "block",
            }}
          >
            {c.title}
          </div>
          {c.meta && <div style={{ fontSize: 28, color: C.muted }}>{c.meta}</div>}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 26,
            color: C.muted,
          }}
        >
          <div style={{ display: "flex" }}>{host}</div>
          <div style={{ display: "flex", fontWeight: 700, color: C.fg }}>
            {siteConfig.name}
            <span style={{ color: C.primary }}>.</span>
          </div>
        </div>
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name: "Noto Sans", data: latin, weight: 700, style: "normal" },
        ...(font
          ? [{ name: FONT_FAMILY, data: font, weight: 700 as const, style: "normal" as const }]
          : []),
      ],
    },
  );
  const png = new Resvg(svg, { fitTo: { mode: "width", value: OG_SIZE.width } }).render().asPng();
  return new Response(png as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      // 文章标题会改，缓存一小时即可
      "Cache-Control": "public, max-age=3600",
    },
  });
}
