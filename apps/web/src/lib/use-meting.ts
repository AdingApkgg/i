"use client";

/**
 * meting 歌曲元数据 → react-query 永不过期缓存。
 * 同一首歌出现在多个 SongRow / 全局播放器里时只请求一次。
 */
import { useQuery } from "@tanstack/react-query";
import { fetchMeting } from "@/components/player/player-context";

export const metingKey = (server: string, type: string, id: string) =>
  ["meting", server, type, id] as const;

export function useMetingSong(server: string, mid: string, enabled: boolean) {
  const { data, isError } = useQuery({
    queryKey: metingKey(server, "song", mid),
    queryFn: () => fetchMeting(server, "song", mid),
    enabled: enabled && Boolean(mid),
    staleTime: Number.POSITIVE_INFINITY,
    retry: 1,
  });
  const song = data?.[0] ?? null;
  return { song, failed: isError || (data != null && data.length === 0) };
}
