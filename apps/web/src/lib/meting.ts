/** Meting API（网易云等歌曲 / 歌单元数据），全站播放器和文章里的选播行共用。 */
export const METING_API = "https://api.injahow.cn/meting/";

export interface MetingSong {
  name: string;
  artist: string;
  url: string;
  pic: string;
  lrc?: string;
}

export async function fetchMeting(server: string, type: string, id: string): Promise<MetingSong[]> {
  const res = await fetch(`${METING_API}?server=${server}&type=${type}&id=${id}`);
  if (!res.ok) throw new Error(`meting ${res.status}`);
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? (data as MetingSong[]) : [];
}
