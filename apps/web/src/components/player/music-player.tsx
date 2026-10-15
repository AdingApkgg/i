import { useQuery } from "@tanstack/react-query";
import {
  Container,
  I18nProvider,
  MuteButton,
  Time,
  TimeSlider,
  VolumeSlider,
} from "@videojs/react";
import { Audio, AudioPlayer, usePlayer } from "@videojs/react/audio";
import zhCN from "@videojs/react/i18n/locales/zh-CN";
import {
  Captions,
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
 * 状态在 stores/player.ts（zustand）：这里负责 Video.js 实例、可视化和界面；
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
import { LyricsPanel } from "./lyrics-panel";
import { MusicPlayButton } from "./play-button";

/** 旧站左下角全局歌单 (netease). */
const DEFAULT_PLAYLIST = "8932390";

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
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void Promise.resolve(usePlayerStore.persist.rehydrate()).then(() => setReady(true));
  }, []);
  // 先恢复偏好再挂载媒体，避免初始音量事件覆盖尚未读取的偏好。
  return ready ? (
    <I18nProvider locale="zh-CN" translations={zhCN}>
      <AudioPlayer>
        <MusicPlayerReady />
      </AudioPlayer>
    </I18nProvider>
  ) : null;
}

function MusicPlayerReady() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const player = usePlayer();
  const intent = useRef(false);
  const appliedLoad = useRef(0);
  const previousSource = useRef<string | undefined>(undefined);
  const errorHandled = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const [ownsMediaSession, setOwnsMediaSession] = useState(false);
  const current = useCurrentSong();
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const load = usePlayerStore((s) => s.load);
  const autoPlay = appliedLoad.current === load.seq ? intent.current : load.autoplay;
  const initQueue = usePlayerStore((s) => s.initQueue);
  const next = usePlayerStore((s) => s.next);

  useEffect(() => {
    return () => {
      setPlayer({ playing: false });
    };
  }, []);
  const source = current?.url;

  // ---- 默认歌单（随机顺序，不自动播放；元数据不会变，永不过期）----
  const { data: playlist } = useQuery({
    queryKey: ["meting", "netease", "playlist", DEFAULT_PLAYLIST],
    queryFn: () => fetchMeting("netease", "playlist", DEFAULT_PLAYLIST),
    staleTime: Number.POSITIVE_INFINITY,
  });
  useEffect(() => {
    if (playlist) initQueue(playlist);
  }, [playlist, initQueue]);

  // 只为最近实际播放的音乐注册系统控制，文章视频播放后交回浏览器。
  useEffect(() => {
    const release = (event: Event) => {
      if (event.target instanceof HTMLMediaElement && event.target !== audioRef.current)
        setOwnsMediaSession(false);
    };
    document.addEventListener("play", release, true);
    return () => document.removeEventListener("play", release, true);
  }, []);

  // Video.js 10 尚不设置系统媒体信息；保留原播放器的锁屏标题和媒体按键。
  useEffect(() => {
    if (
      !ownsMediaSession ||
      !current ||
      !("mediaSession" in navigator) ||
      typeof MediaMetadata === "undefined"
    )
      return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.name,
      artist: current.artist,
      artwork: current.pic ? [{ src: current.pic }] : [],
    });
    return () => {
      navigator.mediaSession.metadata = null;
    };
  }, [current, ownsMediaSession]);

  useEffect(() => {
    if (!ownsMediaSession || !("mediaSession" in navigator)) return;
    const seek = (time: number) => {
      void player.seek(time).catch(() => {});
    };
    const actions: Partial<Record<MediaSessionAction, MediaSessionActionHandler>> = {
      play: () => {
        intent.current = true;
        void player.play().catch(() => {});
      },
      pause: () => {
        intent.current = false;
        player.pause();
      },
      nexttrack: next,
      previoustrack: () => usePlayerStore.getState().prev(),
      seekto: ({ seekTime }) => {
        if (seekTime !== undefined) seek(seekTime);
      },
      seekbackward: ({ seekOffset }) =>
        seek(Math.max(0, (audioRef.current?.currentTime ?? 0) - (seekOffset ?? 10))),
      seekforward: ({ seekOffset }) =>
        seek((audioRef.current?.currentTime ?? 0) + (seekOffset ?? 10)),
    };
    for (const [action, handler] of Object.entries(actions)) {
      try {
        navigator.mediaSession.setActionHandler(action as MediaSessionAction, handler);
      } catch {
        /* 浏览器可能不支持部分动作 */
      }
    }
    return () => {
      for (const action of Object.keys(actions)) {
        try {
          navigator.mediaSession.setActionHandler(action as MediaSessionAction, null);
        } catch {
          /* 同上 */
        }
      }
    };
  }, [player, next, ownsMediaSession]);

  // 原生媒体由 Video.js 管理；显式处理同 URL 重播和异步选播。
  useEffect(() => {
    setFailed(false);
    errorHandled.current = false;
    if (appliedLoad.current !== load.seq) intent.current = load.autoplay;
    appliedLoad.current = load.seq;
    const sameSource = previousSource.current === source;
    previousSource.current = source;
    if (!audioRef.current || (!load.seq && !attempt)) return;
    if (sameSource && audioRef.current.readyState > 0) void player.seek(0).catch(() => {});
    if (intent.current) void player.play().catch(() => {});
    else player.pause();
  }, [load, source, player, attempt]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.volume !== volume) player.setVolume(volume);
    if (audio.muted !== muted) player.setMuted(muted);
  }, [player, volume, muted]);

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
      if (!head.ok || audioRef.current !== audio || deadRef.current) throw new Error("no cors");
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

  const clearAnalyser = useCallback(() => {
    stopLoop();
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
    audioRef.current = null;
    setAnalyserReady(false);
  }, [stopLoop]);
  useEffect(() => () => clearAnalyser(), [clearAnalyser]);

  const handleError = useCallback(() => {
    if (errorHandled.current) return;
    errorHandled.current = true;
    setPlayer({ playing: false });
    if (corsMode) {
      deadRef.current = true;
      clearAnalyser();
      setCorsMode(undefined);
      setAttempt((n) => n + 1);
    } else setFailed(true);
  }, [corsMode, clearAnalyser]);

  const attachAudio = useCallback(
    (audio: HTMLAudioElement | null) => {
      clearAnalyser();
      audioRef.current = audio;
      if (audio) {
        errorHandled.current = false;
        const preferences = usePlayerStore.getState();
        audio.volume = preferences.volume;
        audio.muted = preferences.muted;
      }
    },
    [clearAnalyser],
  );

  return (
    <Container className="music-player" aria-label="音乐播放器">
      <Audio
        key={`${corsMode ?? "no-cors"}-${attempt}`}
        ref={attachAudio}
        src={source}
        preload={attempt ? "auto" : "none"}
        autoPlay={autoPlay}
        crossOrigin={corsMode}
        className="hidden"
        onPlay={() => {
          intent.current = true;
          setOwnsMediaSession(true);
          setPlayer({ playing: true });
          void wireAnalyser();
        }}
        onPause={(event) => {
          // 同时覆盖键盘和系统媒体按键；换源与错误引起的暂停不能改写恢复意图。
          if (
            !errorHandled.current &&
            !event.currentTarget.error &&
            event.currentTarget.readyState >= 2
          )
            intent.current = false;
          setPlayer({ playing: false });
          stopLoop();
        }}
        onEnded={next}
        onVolumeChange={(event) => {
          const audio = event.currentTarget;
          setPlayer({ volume: audio.volume, muted: audio.muted });
        }}
        onError={handleError}
        onErrorCapture={handleError}
      />
      <PlayerDock
        visuals={{
          analyserReady,
          glowOpacity,
          glowScale,
          bars,
          failed,
          setPlayIntent: (play) => {
            intent.current = play;
          },
          retry: () => {
            setFailed(false);
            intent.current = true;
            setAttempt((n) => n + 1);
          },
        }}
      />
    </Container>
  );
}

// ---------------- UI ----------------

interface Visuals {
  failed: boolean;
  retry: () => void;
  setPlayIntent: (play: boolean) => void;
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
  const expand = usePlayerStore((s) => s.expand);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={{ type: "spring", stiffness: 400, damping: 26 }}
      className="relative"
    >
      <button
        type="button"
        onClick={expand}
        title={`${song.name} — ${song.artist}`}
        aria-label="展开音乐播放器"
        className="block"
      >
        <Cover song={song} size={52} visuals={visuals} />
      </button>
      <MusicPlayButton
        onIntent={visuals.setPlayIntent}
        label={playing ? "暂停" : "播放"}
        className="absolute -bottom-0.5 -right-0.5 grid size-5 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm"
      >
        {playing ? (
          <Pause className="size-3 fill-current" />
        ) : (
          <Play className="size-3 fill-current" />
        )}
      </MusicPlayButton>
    </motion.div>
  );
}

/** 进度条单独订阅 time，播放中每秒几次的更新只重绘这一小块 */
function Progress() {
  return (
    <div className="mt-3 flex items-center gap-2 text-[10px] tabular-nums text-muted-foreground">
      <Time.Value type="current" />
      <TimeSlider.Root step={5} label="播放进度" className="music-slider flex-1">
        <TimeSlider.Track className="music-slider-track">
          <TimeSlider.Buffer className="music-slider-buffer" />
          <TimeSlider.Fill className="music-slider-fill" />
        </TimeSlider.Track>
        <TimeSlider.Thumb aria-label="播放进度" className="music-slider-thumb" />
      </TimeSlider.Root>
      <Time.Value type="duration" />
    </div>
  );
}

function ExpandedPanel({ song, visuals }: { song: MetingSong; visuals: Visuals }) {
  const playing = usePlayerStore((s) => s.playing);
  const muted = usePlayerStore((s) => s.muted || s.volume === 0);
  const showQueue = usePlayerStore((s) => s.showQueue);
  const showLyrics = usePlayerStore((s) => s.showLyrics);
  const { collapse, next, prev, toggleQueue, toggleLyrics } = usePlayerStore.getState();
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.92 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="max-h-[calc(100dvh-2rem)] w-72 overflow-y-auto rounded-[var(--radius-lg)] border border-border bg-card/95 p-3 shadow-lg backdrop-blur"
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
          aria-label="收起音乐播放器"
          className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <Progress />
      {visuals.failed && (
        <p role="status" className="mt-2 text-xs text-muted-foreground">
          音乐加载失败，
          <button type="button" className="text-primary" onClick={visuals.retry}>
            重试
          </button>
        </p>
      )}

      {/* controls */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <IconBtn onClick={prev} label="上一首">
            <SkipBack className="size-4 fill-current" />
          </IconBtn>
          <MusicPlayButton
            onIntent={visuals.setPlayIntent}
            label={playing ? "暂停" : "播放"}
            className="grid size-9 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:brightness-105 active:scale-95"
          >
            {playing ? (
              <Pause className="size-4 fill-current" />
            ) : (
              <Play className="size-4 fill-current" />
            )}
          </MusicPlayButton>
          <IconBtn onClick={next} label="下一首">
            <SkipForward className="size-4 fill-current" />
          </IconBtn>
        </div>
        <div className="flex items-center gap-1.5">
          <MuteButton
            aria-label={muted ? "取消静音" : "静音"}
            className="grid size-7 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </MuteButton>
          <VolumeSlider.Root step={5} label="音量" className="music-slider w-14">
            <VolumeSlider.Track className="music-slider-track">
              <VolumeSlider.Fill className="music-slider-fill" />
            </VolumeSlider.Track>
            <VolumeSlider.Thumb aria-label="音量" className="music-slider-thumb" />
          </VolumeSlider.Root>
          <IconBtn onClick={toggleLyrics} label="歌词" active={showLyrics}>
            <Captions className="size-4" />
          </IconBtn>
          <IconBtn onClick={toggleQueue} label="播放列表" active={showQueue}>
            <ListMusic className="size-4" />
          </IconBtn>
        </div>
      </div>

      {showLyrics && <LyricsPanel key={`${song.url}-${song.lrc ?? ""}`} song={song} />}

      {/* queue */}
      <AnimatePresence initial={false}>{showQueue && <Queue />}</AnimatePresence>
    </motion.div>
  );
}

function Queue() {
  const currentRef = useRef<HTMLButtonElement>(null);
  const queue = usePlayerStore((s) => s.queue);
  const index = usePlayerStore((s) => s.index);
  const switchTo = usePlayerStore((s) => s.switchTo);
  useEffect(() => {
    if (queue[index]) currentRef.current?.scrollIntoView({ block: "nearest" });
  }, [index, queue]);
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="overflow-hidden"
    >
      <section
        aria-label="当前歌单"
        className="mt-2 max-h-52 space-y-0.5 overflow-y-auto border-t border-border pt-2"
      >
        {queue.map((s, i) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: 队列允许同一首歌重复出现
            key={`${s.url}-${i}`}
            type="button"
            ref={i === index ? currentRef : undefined}
            aria-current={i === index ? "true" : undefined}
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
      </section>
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
      aria-label={label}
      aria-pressed={active}
      className={`grid size-7 place-items-center rounded-full transition hover:bg-muted ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
