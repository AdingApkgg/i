/**
 * 外部嵌入（iframe）白名单：只放行这些站点的播放器地址，其余一律不渲染。
 * 同时把常见的「页面地址」转成播放器地址，编辑器里直接粘视频链接即可。
 */
const ALLOWED_HOSTS = [
  "player.bilibili.com",
  "www.youtube-nocookie.com",
  "www.youtube.com",
  "music.163.com",
  "player.vimeo.com",
  "open.spotify.com",
  "codepen.io",
  "stackblitz.com",
];

/** 规范化成可嵌入的地址；不认识或不在白名单里返回 null */
export function toEmbedSrc(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input.trim().replace(/^\/\//, "https://"));
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  url.protocol = "https:";

  // B 站视频页 → 播放器
  const bv = /bilibili\.com\/video\/(BV[0-9A-Za-z]+|av\d+)/.exec(url.href);
  if (bv?.[1]) {
    const id = bv[1];
    const key = id.startsWith("BV") ? `bvid=${id}` : `aid=${id.slice(2)}`;
    const page = url.searchParams.get("p") ?? "1";
    return `https://player.bilibili.com/player.html?${key}&page=${page}&autoplay=0`;
  }
  // YouTube 视频页 / 短链 → 无 cookie 播放器
  const yt =
    url.hostname === "youtu.be"
      ? url.pathname.slice(1)
      : /youtube\.com$/.test(url.hostname) && url.pathname === "/watch"
        ? url.searchParams.get("v")
        : null;
  if (yt) return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(yt)}`;

  return ALLOWED_HOSTS.includes(url.hostname) ? url.href : null;
}

/** 链接 href 只放行 http(s)、mailto、站内相对路径和锚点，挡掉 javascript: 之类 */
export function safeHref(href: unknown): string | undefined {
  if (typeof href !== "string") return undefined;
  const s = href.trim();
  if (s.startsWith("/") || s.startsWith("#") || s.startsWith("?")) return s;
  return /^(https?:|mailto:)/i.test(s) ? s : undefined;
}
