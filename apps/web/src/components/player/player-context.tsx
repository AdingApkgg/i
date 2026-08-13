"use client";

import { useQuery } from "@tanstack/react-query";
/**
 * 全站左下角音乐播放器 — 自写实现（不再用 APlayer），设计参考 adx-dl：
 * framer-motion 驱动、音频响应视觉（低频光晕 + EQ 条，CORS 不允许时静默降级）、
 * 迷你旋转唱片 ↔ 展开面板（进度/音量/队列）。选播行通过 usePlayer().play() 换队列。
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
} from "framer-motion";
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
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export const METING_API = "https://api.injahow.cn/meting/";
/** 旧站左下角全局歌单 (netease). */
const DEFAULT_PLAYLIST = "8932390";
const VOLUME_KEY = "i.player.volume";

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

interface PlayerCtx {
  play: (server: string, type: string, id: string) => Promise<void>;
}
const Ctx = createContext<PlayerCtx>({ play: async () => {} });
export const usePlayer = () => useContext(Ctx);

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

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

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [queue, setQueue] = useState<MetingSong[]>([]);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.3);
  const current = queue[index] ?? null;

  // ---- 默认歌单（随机顺序，不自动播放；元数据不会变，永不过期）----
  const { data: playlist } = useQuery({
    queryKey: ["meting", "netease", "playlist", DEFAULT_PLAYLIST],
    queryFn: () => fetchMeting("netease", "playlist", DEFAULT_PLAYLIST),
    staleTime: Number.POSITIVE_INFINITY,
  });
  useEffect(() => {
    if (playlist?.length && queue.length === 0) setQueue(shuffle(playlist));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅首次填充
  }, [playlist]);

  useEffect(() => {
    const saved = Number(localStorage.getItem(VOLUME_KEY));
    if (Number.isFinite(saved) && saved > 0 && saved <= 1) setVolumeState(saved);
  }, []);

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
    if (!audio || audio.crossOrigin !== "anonymous" || !src) return;
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

  // ---- 播放控制 ----
  const loadAndPlay = useCallback((autoplay: boolean) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.load();
    if (autoplay) void audio.play().catch(() => setPlaying(false));
  }, []);

  const switchTo = useCallback(
    (i: number, autoplay = true) => {
      if (!queue.length) return;
      setIndex(((i % queue.length) + queue.length) % queue.length);
      setTime(0);
      setDuration(0);
      // src 变更由 React 渲染，load/play 放到下一帧
      requestAnimationFrame(() => loadAndPlay(autoplay));
    },
    [queue.length, loadAndPlay],
  );

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) void audio.play().catch(() => {});
    else audio.pause();
  }, [current]);

  const play = useCallback(
    async (server: string, type: string, id: string) => {
      try {
        const songs = await fetchMeting(server, type, id);
        if (!songs.length) return;
        setQueue(songs);
        setIndex(0);
        setTime(0);
        setDuration(0);
        setExpanded(true);
        requestAnimationFrame(() => loadAndPlay(true));
      } catch {
        /* keep current playback */
      }
    },
    [loadAndPlay],
  );

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    localStorage.setItem(VOLUME_KEY, String(v));
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = volume;
  }, [volume]);

  // Media Session 元数据（锁屏/系统媒体控制）
  useEffect(() => {
    if (!current || !("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.name,
      artist: current.artist,
      artwork: current.pic ? [{ src: current.pic, sizes: "300x300" }] : [],
    });
  }, [current]);

  const next = useCallback(() => switchTo(index + 1), [switchTo, index]);
  const prev = useCallback(() => switchTo(index - 1), [switchTo, index]);

  return (
    <Ctx.Provider value={{ play }}>
      {children}
      {/* biome-ignore lint/a11y/useMediaCaption: music playback */}
      <audio
        ref={audioRef}
        src={current?.url}
        preload="none"
        crossOrigin={corsMode}
        onPlay={() => {
          setPlaying(true);
          void wireAnalyser();
        }}
        onPause={() => {
          setPlaying(false);
          stopLoop();
        }}
        onEnded={next}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
        onError={() => {
          // CORS 媒体请求被拒：退回普通请求（放弃可视化），播放不受影响。
          if (audioRef.current?.crossOrigin === "anonymous" && !analyserRef.current) {
            deadRef.current = true;
            setCorsMode(undefined);
            requestAnimationFrame(() => loadAndPlay(playing));
          }
        }}
      />
      <PlayerDock
        current={current}
        queue={queue}
        index={index}
        playing={playing}
        expanded={expanded}
        showQueue={showQueue}
        time={time}
        duration={duration}
        volume={volume}
        analyserReady={analyserReady}
        glowOpacity={glowOpacity}
        glowScale={glowScale}
        bars={bars}
        onToggle={toggle}
        onNext={next}
        onPrev={prev}
        onSeek={(t) => {
          const a = audioRef.current;
          if (a && Number.isFinite(t)) a.currentTime = t;
        }}
        onVolume={setVolume}
        onSwitch={(i) => switchTo(i)}
        onExpand={() => setExpanded(true)}
        onCollapse={() => {
          setExpanded(false);
          setShowQueue(false);
        }}
        onToggleQueue={() => setShowQueue((v) => !v)}
      />
    </Ctx.Provider>
  );
}

// ---------------- UI ----------------

interface DockProps {
  current: MetingSong | null;
  queue: MetingSong[];
  index: number;
  playing: boolean;
  expanded: boolean;
  showQueue: boolean;
  time: number;
  duration: number;
  volume: number;
  analyserReady: boolean;
  glowOpacity: MotionValue<number>;
  glowScale: MotionValue<number>;
  bars: MotionValue<number>[];
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (t: number) => void;
  onVolume: (v: number) => void;
  onSwitch: (i: number) => void;
  onExpand: () => void;
  onCollapse: () => void;
  onToggleQueue: () => void;
}

function PlayerDock(p: DockProps) {
  if (!p.current) return null;
  return (
    <div className="fixed bottom-4 left-4 z-40 hidden md:block">
      <AnimatePresence mode="wait" initial={false}>
        {p.expanded ? <ExpandedPanel key="panel" {...p} /> : <MiniDisc key="mini" {...p} />}
      </AnimatePresence>
    </div>
  );
}

function Cover({
  song,
  size,
  spinning,
  glowOpacity,
  glowScale,
}: {
  song: MetingSong;
  size: number;
  spinning: boolean;
  glowOpacity: DockProps["glowOpacity"];
  glowScale: DockProps["glowScale"];
}) {
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <motion.span
        aria-hidden
        className="absolute inset-0 rounded-full bg-primary blur-md"
        style={{ opacity: glowOpacity, scale: glowScale }}
      />
      {song.pic ? (
        // biome-ignore lint/performance/noImgElement: 外链封面
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

function MiniDisc(p: DockProps) {
  return (
    <motion.button
      type="button"
      onClick={p.onExpand}
      title={`${p.current!.name} — ${p.current!.artist}`}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{ type: "spring", stiffness: 400, damping: 26 }}
      className="group relative block"
    >
      <Cover
        song={p.current!}
        size={52}
        spinning={p.playing}
        glowOpacity={p.glowOpacity}
        glowScale={p.glowScale}
      />
      <span
        className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm"
        onClick={(e) => {
          e.stopPropagation();
          p.onToggle();
        }}
      >
        {p.playing ? (
          <Pause className="size-3 fill-current" />
        ) : (
          <Play className="size-3 fill-current" />
        )}
      </span>
    </motion.button>
  );
}

function ExpandedPanel(p: DockProps) {
  const song = p.current!;
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
        <Cover
          song={song}
          size={44}
          spinning={p.playing}
          glowOpacity={p.glowOpacity}
          glowScale={p.glowScale}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{song.name}</div>
          <div className="truncate text-xs text-muted-foreground">{song.artist}</div>
        </div>
        {p.analyserReady && (
          <div aria-hidden className="flex h-5 shrink-0 items-end gap-[2px]">
            {p.bars.map((bar, i) => (
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
          onClick={p.onCollapse}
          className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* progress */}
      <div className="mt-3 flex items-center gap-2 text-[10px] tabular-nums text-muted-foreground">
        <span>{fmt(p.time)}</span>
        <input
          type="range"
          min={0}
          max={p.duration || 0}
          step={1}
          value={Math.min(p.time, p.duration || 0)}
          onChange={(e) => p.onSeek(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer accent-[var(--primary)]"
        />
        <span>{p.duration ? fmt(p.duration) : "-:--"}</span>
      </div>

      {/* controls */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <IconBtn onClick={p.onPrev} label="上一首">
            <SkipBack className="size-4 fill-current" />
          </IconBtn>
          <button
            type="button"
            onClick={p.onToggle}
            className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:brightness-105 active:scale-95"
          >
            {p.playing ? (
              <Pause className="size-4 fill-current" />
            ) : (
              <Play className="size-4 fill-current" />
            )}
          </button>
          <IconBtn onClick={p.onNext} label="下一首">
            <SkipForward className="size-4 fill-current" />
          </IconBtn>
        </div>
        <div className="flex items-center gap-1.5">
          <IconBtn onClick={() => p.onVolume(p.volume > 0 ? 0 : 0.3)} label="静音">
            {p.volume > 0 ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
          </IconBtn>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={p.volume}
            onChange={(e) => p.onVolume(Number(e.target.value))}
            className="h-1 w-14 cursor-pointer accent-[var(--primary)]"
          />
          <IconBtn onClick={p.onToggleQueue} label="播放列表" active={p.showQueue}>
            <ListMusic className="size-4" />
          </IconBtn>
        </div>
      </div>

      {/* queue */}
      <AnimatePresence initial={false}>
        {p.showQueue && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mt-2 max-h-52 space-y-0.5 overflow-y-auto border-t border-border pt-2">
              {p.queue.map((s, i) => (
                <button
                  key={`${s.url}-${i}`}
                  type="button"
                  onClick={() => p.onSwitch(i)}
                  className={`flex w-full items-center gap-2 rounded-[var(--radius-sm)] px-2 py-1.5 text-left text-xs transition ${
                    i === p.index
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
        )}
      </AnimatePresence>
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
