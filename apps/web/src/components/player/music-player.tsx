import { useQuery } from "@tanstack/react-query";
import {
  ListMusic,
  Music2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
/**
 * 全站左下角音乐播放器 — 自写实现（不再用 APlayer），设计参考 adx-dl：
 * motion 驱动、音频响应视觉（低频光晕 + EQ 条，CORS 不允许时静默降级）、
 * 迷你旋转唱片 ↔ 展开面板（进度/音量/队列）。
 * 状态在 stores/player.ts（zustand）：这里负责 <audio> 元素、可视化和界面；
 * 文章里的选播行直接调用 usePlayerStore 的 play() 换队列。
 */
import {
  AnimatePresence,
  animate,
  type MotionValue,
  motion,
  motionValue,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { fetchMeting, type MetingSong } from "@/lib/meting";
import { useCurrentSong, usePlayerStore } from "@/stores/player";

/** 旧站左下角全局歌单 (netease). */
const DEFAULT_PLAYLIST = "8932390";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// fftSize 256 → 128 bins；粗略对数分带（同 adx-dl）。
const EQ_BANDS: ReadonlyArray<readonly [number, number]> = [
  [1, 4],
  [4, 8],
  [8, 16],
  [16, 32],
  [32, 64],
];
const BAR_REST = 0.15;
const LOW_BINS = 8;

const setPlayer = usePlayerStore.setState;

export function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const current = useCurrentSong();
  const volume = usePlayerStore((s) => s.volume);
  const load = usePlayerStore((s) => s.load);
  const initQueue = usePlayerStore((s) => s.initQueue);
  const next = usePlayerStore((s) => s.next);

  // 读回上次的音量；登记 <audio> 给 store 的 toggle / seek 用
  useEffect(() => {
    void usePlayerStore.persist.rehydrate();
    setPlayer({ audio: audioRef.current });
    return () => {
      setPlayer({ audio: null, playing: false });
    };
  }, []);

  // ---- 默认歌单（随机顺序，不自动播放；元数据不会变，永不过期）----
  const { data: playlist } = useQuery({
    queryKey: ["meting", "netease", "playlist", DEFAULT_PLAYLIST],
    queryFn: () => fetchMeting("netease", "playlist", DEFAULT_PLAYLIST),
    staleTime: Number.POSITIVE_INFINITY,
  });
  useEffect(() => {
    if (playlist) initQueue(playlist);
  }, [playlist, initQueue]);

  // ---- 换歌：src 已随本次渲染更新，load 后按需播放 ----
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || load.seq === 0) return;
    audio.load();
    if (load.autoplay) void audio.play().catch(() => setPlayer({ playing: false }));
  }, [load]);

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = volume;
  }, [volume]);

  // ---- 音频响应视觉（adx-dl 式防御：CORS 不通则永久降级，绝不弄哑播放）----
  const reduced = useReducedMotion();
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataRef = useRef<Uint8Array | null>(null);
  const rafRef = useRef(0);
  const deadRef = useRef(false);
  const [corsMode, setCorsMode] = useState<"anonymous" | undefined>("anonymous");
  const [analyserReady, setAnalyserReady] = useState(false);
  const glow = useMotionValue(0);
  const glowOpacity = useTransform(glow, [0, 1], [0.12, 0.8]);
  const glowScale = useTransform(glow, [0, 1], [0.95, 1.18]);
  const [bars] = useState(() => EQ_BANDS.map(() => motionValue(BAR_REST)));

  const stopLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    animate(glow, 0, { duration: 0.5 });
    for (const b of bars) animate(b, BAR_REST, { duration: 0.4 });
  }, [glow, bars]);

  const startLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (rafRef.current || !analyser) return;
    if (!dataRef.current || dataRef.current.length !== analyser.frequencyBinCount)
      dataRef.current = new Uint8Array(analyser.frequencyBinCount);
    const data = dataRef.current;
    const tick = () => {
      const audio = audioRef.current;
      if (!audio || audio.paused || document.hidden) {
        rafRef.current = 0;
        return;
      }
      analyser.getByteFrequencyData(data as Uint8Array<ArrayBuffer>);
      let low = 0;
      for (let i = 0; i < LOW_BINS; i++) low += data[i] ?? 0;
      glow.set(low / (LOW_BINS * 255));
      EQ_BANDS.forEach(([s, e], b) => {
        let sum = 0;
        for (let i = s; i < e; i++) sum += data[i] ?? 0;
        bars[b]?.set(BAR_REST + (sum / ((e - s) * 255)) * (1 - BAR_REST));
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [glow, bars]);

  const wireAnalyser = useCallback(async () => {
    if (reduced || deadRef.current) return;
    if (analyserRef.current) {
      void audioCtxRef.current?.resume().catch(() => {});
      startLoop();
      return;
    }
    const audio = audioRef.current;
    const src = audio?.currentSrc;
    if (audio?.crossOrigin !== "anonymous" || !src) return;
    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
      const head = await fetch(src, { method: "HEAD", mode: "cors" });
      if (!head.ok) throw new Error("no cors");
      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyser.connect(ctx.destination);
      void ctx.resume().catch(() => {});
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      setAnalyserReady(true);
      if (!audio.paused) startLoop();
    } catch {
      deadRef.current = true;
      void ctx?.close().catch(() => {});
    }
  }, [reduced, startLoop]);

  // Media Session 元数据（锁屏/系统媒体控制）
  useEffect(() => {
    if (!current || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.name,
      artist: current.artist,
      artwork: current.pic ? [{ src: current.pic, sizes: "300x300" }] : [],
    });
  }, [current]);

  return (
    <>
      {/* biome-ignore lint/a11y/useMediaCaption: music playback */}
      <audio
        ref={audioRef}
        src={current?.url}
        preload="none"
        crossOrigin={corsMode}
        onPlay={() => {
          setPlayer({ playing: true });
          void wireAnalyser();
        }}
        onPause={() => {
          setPlayer({ playing: false });
          stopLoop();
        }}
        onEnded={next}
        onTimeUpdate={(e) => setPlayer({ time: e.currentTarget.currentTime })}
        onDurationChange={(e) => setPlayer({ duration: e.currentTarget.duration || 0 })}
        onError={() => {
          // CORS 媒体请求被拒：退回普通请求（放弃可视化），播放不受影响。
          if (audioRef.current?.crossOrigin === "anonymous" && !analyserRef.current) {
            deadRef.current = true;
            setCorsMode(undefined);
            const resume = usePlayerStore.getState().playing;
            requestAnimationFrame(() => {
              const a = audioRef.current;
              if (!a) return;
              a.load();
              if (resume) void a.play().catch(() => setPlayer({ playing: false }));
            });
          }
        }}
      />
      <PlayerDock visuals={{ analyserReady, glowOpacity, glowScale, bars }} />
    </>
  );
}

// ---------------- UI ----------------

interface Visuals {
  analyserReady: boolean;
  glowOpacity: MotionValue<number>;
  glowScale: MotionValue<number>;
  bars: MotionValue<number>[];
}

function PlayerDock({ visuals }: { visuals: Visuals }) {
  const current = useCurrentSong();
  const expanded = usePlayerStore((s) => s.expanded);
  if (!current) return null;
  return (
    <div className="fixed bottom-4 left-4 z-40 hidden md:block">
      <AnimatePresence mode="wait" initial={false}>
        {expanded ? (
          <ExpandedPanel key="panel" song={current} visuals={visuals} />
        ) : (
          <MiniDisc key="mini" song={current} visuals={visuals} />
        )}
      </AnimatePresence>
    </div>
  );
}

function Cover({ song, size, visuals }: { song: MetingSong; size: number; visuals: Visuals }) {
  const spinning = usePlayerStore((s) => s.playing);
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full bg-primary blur-md"
        style={{ opacity: visuals.glowOpacity, scale: visuals.glowScale }}
      />
      {song.pic ? (
        <img
          src={song.pic}
          alt=""
          className="relative h-full w-full rounded-full border-2 border-card object-cover shadow-md"
          style={{
            animation: "spin 14s linear infinite",
            animationPlayState: spinning ? "running" : "paused",
          }}
        />
      ) : (
        <span className="relative grid h-full w-full place-items-center rounded-full bg-soft text-primary">
          <Music2 className="size-5" />
        </span>
      )}
    </span>
  );
}

function MiniDisc({ song, visuals }: { song: MetingSong; visuals: Visuals }) {
  const playing = usePlayerStore((s) => s.playing);
  const { expand, toggle } = usePlayerStore.getState();
  return (
    <motion.button
      type="button"
      onClick={expand}
      title={`${song.name} — ${song.artist}`}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{ type: "spring", stiffness: 400, damping: 26 }}
      className="group relative block"
    >
      <Cover song={song} size={52} visuals={visuals} />
      {/* biome-ignore lint/a11y/noStaticElementInteractions: 嵌在外层按钮内（button 不能套 button），键盘走展开面板的播放键 */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: 同上 */}
      <span
        className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
      >
        {playing ? (
          <Pause className="size-3 fill-current" />
        ) : (
          <Play className="size-3 fill-current" />
        )}
      </span>
    </motion.button>
  );
}

/** 进度条单独订阅 time，播放中每秒几次的更新只重绘这一小块 */
function Progress() {
  const time = usePlayerStore((s) => s.time);
  const duration = usePlayerStore((s) => s.duration);
  const seek = usePlayerStore((s) => s.seek);
  return (
    <div className="mt-3 flex items-center gap-2 text-[10px] tabular-nums text-muted-foreground">
      <span>{fmt(time)}</span>
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={1}
        value={Math.min(time, duration || 0)}
        onChange={(e) => seek(Number(e.target.value))}
        className="h-1 flex-1 cursor-pointer accent-[var(--primary)]"
      />
      <span>{duration ? fmt(duration) : "-:--"}</span>
    </div>
  );
}

function ExpandedPanel({ song, visuals }: { song: MetingSong; visuals: Visuals }) {
  const playing = usePlayerStore((s) => s.playing);
  const volume = usePlayerStore((s) => s.volume);
  const showQueue = usePlayerStore((s) => s.showQueue);
  const { collapse, toggle, next, prev, setVolume, toggleQueue } = usePlayerStore.getState();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.92 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="w-72 rounded-[var(--radius-lg)] border border-border bg-card/95 p-3 shadow-lg backdrop-blur"
    >
      {/* header */}
      <div className="flex items-center gap-3">
        <Cover song={song} size={44} visuals={visuals} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{song.name}</div>
          <div className="truncate text-xs text-muted-foreground">{song.artist}</div>
        </div>
        {visuals.analyserReady && (
          <div aria-hidden className="flex h-5 shrink-0 items-end gap-[2px]">
            {visuals.bars.map((bar, i) => (
              <motion.span
                // biome-ignore lint/suspicious/noArrayIndexKey: static band count
                key={i}
                className="h-full w-[3px] origin-bottom rounded-full bg-primary/80"
                style={{ scaleY: bar }}
              />
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={collapse}
          className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <Progress />

      {/* controls */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <IconBtn onClick={prev} label="上一首">
            <SkipBack className="size-4 fill-current" />
          </IconBtn>
          <button
            type="button"
            onClick={toggle}
            className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:brightness-105 active:scale-95"
          >
            {playing ? (
              <Pause className="size-4 fill-current" />
            ) : (
              <Play className="size-4 fill-current" />
            )}
          </button>
          <IconBtn onClick={next} label="下一首">
            <SkipForward className="size-4 fill-current" />
          </IconBtn>
        </div>
        <div className="flex items-center gap-1.5">
          <IconBtn onClick={() => setVolume(volume > 0 ? 0 : 0.3)} label="静音">
            {volume > 0 ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </IconBtn>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="h-1 w-14 cursor-pointer accent-[var(--primary)]"
          />
          <IconBtn onClick={toggleQueue} label="播放列表" active={showQueue}>
            <ListMusic className="size-4" />
          </IconBtn>
        </div>
      </div>

      {/* queue */}
      <AnimatePresence initial={false}>{showQueue && <Queue />}</AnimatePresence>
    </motion.div>
  );
}

function Queue() {
  const queue = usePlayerStore((s) => s.queue);
  const index = usePlayerStore((s) => s.index);
  const switchTo = usePlayerStore((s) => s.switchTo);
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="overflow-hidden"
    >
      <div className="mt-2 max-h-52 space-y-0.5 overflow-y-auto border-t border-border pt-2">
        {queue.map((s, i) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: 队列允许同一首歌重复出现
            key={`${s.url}-${i}`}
            type="button"
            onClick={() => switchTo(i)}
            className={`flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-xs transition ${
              i === index
                ? "bg-soft font-medium text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span className="w-5 shrink-0 text-right tabular-nums">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate">{s.name}</span>
            <span className="max-w-[80px] shrink-0 truncate opacity-70">{s.artist}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`grid size-7 place-items-center rounded-full transition hover:bg-muted ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
