/**
 * 全站音乐播放器的状态（zustand）。
 * 任何组件都能直接换歌单（usePlayerStore.getState().play / 选择器），不需要 Provider；
 * Video.js 实例与可视化由 components/player/music-player.tsx 负责，这里只管状态和指令。
 * 音量持久化到 localStorage。
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { fetchMeting, type MetingSong } from "@/lib/meting";
import { localStorageWithLegacy } from "./storage";

const DEFAULT_VOLUME = 0.3;

interface PlayerState {
  queue: MetingSong[];
  index: number;
  playing: boolean;
  expanded: boolean;
  showQueue: boolean;
  showLyrics: boolean;
  volume: number;
  muted: boolean;
  /** 每次换歌递增，包含重复播放同一首歌的情况。 */
  load: { seq: number; autoplay: boolean };

  /** 默认歌单：只在队列为空时填入（打乱顺序，不自动播放） */
  initQueue: (songs: MetingSong[]) => void;
  /** 换成某个歌单 / 专辑 / 单曲并开始播放（文章里的选播行调用） */
  play: (server: string, type: string, id: string) => Promise<void>;
  switchTo: (i: number, autoplay?: boolean) => void;
  next: () => void;
  prev: () => void;
  setVolume: (v: number) => void;
  expand: () => void;
  collapse: () => void;
  toggleQueue: () => void;
  toggleLyrics: () => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** 旧版单独存的音量 key */
function legacyVolume(): { volume: number } | null {
  const v = Number(localStorage.getItem("i.player.volume"));
  return localStorage.getItem("i.player.volume") !== null && v > 0 && v <= 1 ? { volume: v } : null;
}

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => {
      // 只接受最近一次选播或队列切歌，避免慢请求打断后续选择。
      let selection = 0;
      /** 换到某首：通知播放器组件换源或重播 */
      const loadAt = (index: number, autoplay: boolean, extra: Partial<PlayerState> = {}) =>
        set((s) => ({
          ...extra,
          index,
          load: { seq: s.load.seq + 1, autoplay },
        }));

      return {
        queue: [],
        index: 0,
        playing: false,
        expanded: false,
        showQueue: false,
        showLyrics: false,
        volume: DEFAULT_VOLUME,
        muted: false,
        load: { seq: 0, autoplay: false },

        initQueue: (songs) => {
          if (songs.length && get().queue.length === 0) set({ queue: shuffle(songs) });
        },
        play: async (server, type, id) => {
          const request = ++selection;
          try {
            const songs = await fetchMeting(server, type, id);
            if (request === selection && songs.length) {
              loadAt(0, true, { queue: songs, expanded: true });
            }
          } catch {
            /* 拉不到就保持当前播放 */
          }
        },
        switchTo: (i, autoplay = true) => {
          const n = get().queue.length;
          if (n) {
            selection++;
            loadAt(((i % n) + n) % n, autoplay);
          }
        },
        next: () => get().switchTo(get().index + 1),
        prev: () => get().switchTo(get().index - 1),
        setVolume: (volume) => set({ volume }),
        expand: () => set({ expanded: true }),
        collapse: () => set({ expanded: false, showQueue: false, showLyrics: false }),
        toggleQueue: () => set((s) => ({ showQueue: !s.showQueue })),
        toggleLyrics: () => set((s) => ({ showLyrics: !s.showLyrics })),
      };
    },
    {
      name: "i.player",
      storage: localStorageWithLegacy(legacyVolume),
      partialize: ({ volume, muted }) => ({ volume, muted }),
      skipHydration: true,
    },
  ),
);

/** 当前歌曲 */
export const useCurrentSong = () => usePlayerStore((s) => s.queue[s.index] ?? null);
