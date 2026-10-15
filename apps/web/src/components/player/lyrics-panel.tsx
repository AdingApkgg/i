import { useQuery } from "@tanstack/react-query";
import { usePlayer } from "@videojs/react/audio";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { activeLyricIndex, loadLyrics } from "@/lib/lyrics";
import type { MetingSong } from "@/lib/meting";

export function LyricsPanel({ song }: { song: MetingSong }) {
  const player = usePlayer();
  const source = song.lrc?.trim() ?? "";
  const query = useQuery({
    queryKey: ["lyrics", song.url, source],
    queryFn: ({ signal }) => loadLyrics(source, signal),
    enabled: !!source,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });
  const lines = query.data?.lines ?? [];
  // 每帧时间变化只在跨到另一句时重绘歌词，不写入持久化状态。
  const active = usePlayer((state) => activeLyricIndex(lines, state.currentTime));
  const [following, setFollowing] = useState(true);
  const view = useRef<HTMLElement>(null);
  const row = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const container = view.current,
      current = row.current;
    if (!following || active < 0 || !container || !current) return;
    const top =
      container.scrollTop +
      current.getBoundingClientRect().top -
      container.getBoundingClientRect().top -
      (container.clientHeight - current.offsetHeight) / 2;
    container.scrollTo({ top, behavior: reduced ? "instant" : "smooth" });
  }, [active, following, reduced]);

  return (
    <section aria-label="歌词" className="mt-2 border-t border-border pt-2">
      <div className="mb-1 flex min-h-5 items-center justify-between text-[10px] text-muted-foreground">
        <span>{lines.length ? "滚动歌词 · 点击跳转" : "歌词"}</span>
        {!following && lines.length > 0 && (
          <button type="button" className="text-primary" onClick={() => setFollowing(true)}>
            回到当前歌词
          </button>
        )}
      </div>
      {!source ? (
        <p className="py-4 text-center text-xs text-muted-foreground">暂无歌词</p>
      ) : query.isPending ? (
        <p role="status" className="py-4 text-center text-xs text-muted-foreground">
          歌词加载中…
        </p>
      ) : query.isError ? (
        <p role="status" className="py-4 text-center text-xs text-muted-foreground">
          歌词加载失败，
          <button type="button" className="text-primary" onClick={() => void query.refetch()}>
            重试
          </button>
        </p>
      ) : lines.length ? (
        <section
          ref={view}
          aria-label="歌词滚动区域"
          data-lyric-scroll
          className="relative max-h-44 overflow-y-auto overscroll-contain py-2"
          onWheel={() => setFollowing(false)}
          onTouchStart={() => setFollowing(false)}
          onPointerDown={() => setFollowing(false)}
          onKeyDown={(event) => {
            if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].includes(event.key))
              setFollowing(false);
          }}
        >
          {lines.map((line, index) => (
            <button
              key={line.time}
              ref={index === active ? row : undefined}
              type="button"
              aria-current={index === active ? "true" : undefined}
              onClick={() => {
                void player.seek(line.time).catch(() => {});
                setFollowing(true);
              }}
              className={`block w-full whitespace-pre-line rounded-md px-2 py-2 text-center text-xs leading-5 transition-colors hover:bg-muted ${index === active ? "bg-soft font-semibold text-primary" : "text-muted-foreground"}`}
            >
              {line.text || "♪"}
            </button>
          ))}
        </section>
      ) : query.data?.text.length ? (
        <div className="max-h-44 overflow-y-auto overscroll-contain py-2 text-center text-xs leading-6 text-muted-foreground">
          <p className="mb-1 text-[10px]">此歌词暂无时间信息</p>
          {query.data.text.map((text, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: 同一首歌的纯文本行顺序固定，可能重复。
            <p key={`${index}-${text}`}>{text}</p>
          ))}
        </div>
      ) : (
        <p className="py-4 text-center text-xs text-muted-foreground">暂无歌词</p>
      )}
    </section>
  );
}
