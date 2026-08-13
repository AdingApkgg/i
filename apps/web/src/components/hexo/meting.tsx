"use client";

/**
 * 选播 row for imported <meting-js> tags. Instead of stacking embedded players
 * (the old mistake), each song renders as a clickable row and playlists as a
 * play button — both hand the target to the global bottom-left player.
 */
import { useEffect, useRef, useState } from "react";
import { fetchMeting, usePlayer } from "../player/player-context";

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
        ▶ 播放{label}
      </button>
    );
  }
  return <SongRow server={server} mid={mid} onPlay={() => void play(server, "song", mid)} />;
}

function SongRow({
  server,
  mid,
  onPlay,
}: {
  server: string;
  mid: string;
  onPlay: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [meta, setMeta] = useState<{ name: string; artist: string; pic?: string } | null>(null);
  const [failed, setFailed] = useState(false);

  // Lazy-resolve song meta only when the row scrolls into view (rows hide
  // inside tabs/折叠, so this avoids hammering the meting API on page load).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let done = false;
    const io = new IntersectionObserver(
      (entries) => {
        if (done || !entries.some((e) => e.isIntersecting)) return;
        done = true;
        io.disconnect();
        fetchMeting(server, "song", mid)
          .then((songs) => {
            const s = songs[0];
            if (s) setMeta({ name: s.name, artist: s.artist, pic: s.pic });
            else setFailed(true);
          })
          .catch(() => setFailed(true));
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [server, mid]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onPlay}
      className="group my-0.5 flex w-full items-center gap-3 rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 text-left transition hover:border-primary/50 hover:bg-soft"
    >
      {meta?.pic ? (
        // biome-ignore lint/a11y/useAltText: decorative cover
        <img src={meta.pic} alt="" loading="lazy" className="size-9 shrink-0 rounded object-cover" />
      ) : (
        <span className="grid size-9 shrink-0 place-items-center rounded bg-soft text-primary/60">
          ♪
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {meta?.name ?? (failed ? `${server} · ${mid}` : "加载中…")}
        </span>
        {meta?.artist && (
          <span className="block truncate text-xs text-muted-foreground">{meta.artist}</span>
        )}
      </span>
      <span className="shrink-0 text-primary opacity-0 transition group-hover:opacity-100">▶</span>
    </button>
  );
}
