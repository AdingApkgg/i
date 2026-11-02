/** 两种 Meting 响应格式共用；原接口不支持 album / artist。 */
export const METING_API = "https://api.injahow.cn/meting/";
const FULL_API = "https://api.i-meto.com/meting/api";

export interface MetingSong {
  name: string;
  artist: string;
  url: string;
  pic: string;
  lrc?: string;
  sourceUrl?: string;
}

function mediaUrl(value: unknown): string {
  if (typeof value !== "string" || !value) return "";
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : "";
  } catch {
    return "";
  }
}

function normalize(data: unknown, server: string, type: string, id: string): MetingSong[] {
  if (!Array.isArray(data) || !data.length) throw new Error("音乐接口未返回歌曲");
  return data.map((value: unknown) => {
    if (!value || typeof value !== "object") throw new Error("音乐资料格式异常");
    const row = value as Record<string, unknown>;
    const name = row.name ?? row.title;
    const artist = row.artist ?? row.author;
    let url = mediaUrl(row.url);
    if (typeof name !== "string" || !name.trim() || typeof artist !== "string" || !url)
      throw new Error("音乐资料格式异常");
    const parsed = new URL(url, "https://site.invalid");
    const trackId = parsed.searchParams.get("id") ?? (type === "song" ? id : "");
    // 完整接口的元数据可用，但 url 解析端点失效；沿用可用接口解析同平台、同 ID。
    if (
      parsed.hostname === "api.i-meto.com" &&
      parsed.pathname === "/meting/api" &&
      parsed.searchParams.get("server") === server &&
      parsed.searchParams.get("type") === "url" &&
      /^[a-zA-Z0-9]+$/.test(trackId)
    ) {
      url = `${METING_API}?${new URLSearchParams({ server, type: "url", id: trackId })}`;
    }
    const sourceUrl = /^[a-zA-Z0-9]+$/.test(trackId)
      ? server === "netease"
        ? `https://music.163.com/#/song?id=${trackId}`
        : server === "tencent"
          ? `https://y.qq.com/n/ryqq/songDetail/${trackId}`
          : undefined
      : undefined;
    // 歌词支持远程地址、站内地址及内联 LRC / 文本，交给 loadLyrics 校验和解析。
    const lrc = typeof row.lrc === "string" ? row.lrc : "";
    return {
      name,
      artist,
      url,
      pic: mediaUrl(row.pic),
      ...(lrc ? { lrc } : {}),
      ...(sourceUrl ? { sourceUrl } : {}),
    };
  });
}

export async function fetchMeting(server: string, type: string, id: string): Promise<MetingSong[]> {
  const query = new URLSearchParams({ server, type, id });
  const endpoints = type === "album" || type === "artist" ? [FULL_API] : [METING_API, FULL_API];
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`${endpoint}?${query}`, { signal: AbortSignal.timeout(12000) });
      if (!res.ok) throw new Error(`meting ${res.status}`);
      return normalize(await res.json(), server, type, id);
    } catch {
      // 同一首歌 / 歌单换接口，不做搜索匹配或替换版本。
    }
  }
  throw new Error("音乐信息暂时不可用，请稍后重试或前往原平台");
}
