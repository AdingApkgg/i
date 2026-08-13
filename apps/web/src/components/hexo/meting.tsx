"use client";

/**
 * 选播 row for imported <meting-js> tags. Instead of stacking embedded players
 * (the old mistake), each song renders as a clickable row and playlists as a
 * play button — both hand the target to the global bottom-left player.
 * 歌曲元数据经 SWR 去重缓存，进入视口才请求。
 */
import { AnimatePresence, motion } from "framer-motion";
import { Music2, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMetingSong } from "@/lib/use-meting";
import { usePlayer } from "../player/player-context";

const TYPE_LABEL: Record<string, string> = {
  playlist: "歌单",
  album: "专辑",
  artist: "艺术家",
};

export function Meting({
  server = "netease",
  type = "song",
  mid = "",
}: {
  server?: string;
  type?: string;
  mid?: string;
}) {
  const { play } = usePlayer();
  if (type !== "song") {
    const label = TYPE_LABEL[type] ?? type;
    return (
      <button
        type="button"
        onClick={() => void play(server, type, mid)}
        className="my-1 inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground transition hover:brightness-105 active:translate-y-px"
      >
        <Play className="size-3.5 fill-current" /> 播放{label}
      </button>
    );
  }
  return <SongRow server={server} mid={mid} onPlay={() => void play(server, "song", mid)} />;
}

function SongRow({ server, mid, onPlay }: { server: string; mid: string; onPlay: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);

  // Lazy-resolve song meta only when the row scrolls into view (rows hide
  // inside tabs/折叠, so this avoids hammering the meting API on page load).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setVisible(true);
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const { song, failed } = useMetingSong(server, mid, visible);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onPlay}
      className="group my-0.5 flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 text-left transition hover:border-primary/50 hover:bg-soft"
    >
      {song?.pic ? (
        // biome-ignore lint/performance/noImgElement: 外链封面，沿用原生 img
        <motion.img
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          src={song.pic}
          alt=""
          loading="lazy"
          className="size-9 shrink-0 rounded object-cover"
        />
      ) : (
        <span className="grid size-9 shrink-0 place-items-center rounded bg-soft text-primary/60">
          <Music2 className="size-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          {song ? (
            <motion.span
              key="meta"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="block"
            >
              <span className="block truncate text-sm font-medium">{song.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{song.artist}</span>
            </motion.span>
          ) : failed ? (
            <motion.span
              key="fallback"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="block truncate text-sm font-medium"
            >
              {server} · {mid}
            </motion.span>
          ) : (
            <motion.span key="skeleton" exit={{ opacity: 0 }} className="block space-y-1.5">
              <span className="block h-3.5 w-32 max-w-full animate-pulse rounded bg-soft" />
              <span className="block h-3 w-20 max-w-full animate-pulse rounded bg-soft" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <Play className="size-4 shrink-0 fill-current text-primary opacity-0 transition group-hover:opacity-100" />
    </button>
  );
}
