/**
 * 相册图片的缩略图地址：存在自家对象存储里的图（/api/gallery/files/<key>）加 ?w= 取等比缩放的 WebP，
 * 服务端首次请求时生成并存回存储（server/thumbs.ts）。外链图片原样返回。
 */

/** 服务端只接受这些宽度，避免任意宽度把存储 / CDN 缓存撑爆 */
export const THUMB_WIDTHS = [320, 640, 960, 1280, 1920, 2560] as const;
export type ThumbWidth = (typeof THUMB_WIDTHS)[number];

export const isThumbWidth = (n: number): n is ThumbWidth =>
  (THUMB_WIDTHS as readonly number[]).includes(n);

const STORED = "/api/gallery/files/";

/** 能缩放：自家存储里的位图（svg 原样用） */
export function isResizable(url: string) {
  return url.startsWith(STORED) && !url.includes("?") && !/\.svg$/i.test(url);
}

export function thumb(url: string, w: ThumbWidth) {
  return isResizable(url) ? `${url}?w=${w}` : url;
}

/**
 * <img> 的 src / srcSet / sizes：浏览器按实际显示宽度和像素密度挑最合适的一档。
 * src 取最大一档（不支持 srcset 时的兜底）。
 */
export function thumbProps(url: string, widths: readonly ThumbWidth[], sizes: string) {
  if (!isResizable(url)) return { src: url };
  return {
    src: thumb(url, widths[widths.length - 1]!),
    srcSet: widths.map((w) => `${thumb(url, w)} ${w}w`).join(", "),
    sizes,
  };
}
