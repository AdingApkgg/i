"use client";

/**
 * Global fixed audio player (bottom-left), mirroring the old Butterfly site:
 * one APlayer in fixed mode preloaded with the site playlist; content pages
 * offer 选播 rows that call `usePlayer().play(...)` to swap what's playing.
 */
import { createContext, type ReactNode, useContext, useEffect, useRef } from "react";

export const METING_API = "https://api.injahow.cn/meting/";
/** 旧站左下角全局歌单 (netease). */
const DEFAULT_PLAYLIST = "8932390";

export interface MetingSong {
  name: string;
  artist: string;
  url: string;
  pic: string;
  lrc?: string;
}

interface PlayerCtx {
  play: (server: string, type: string, id: string) => Promise<void>;
}

const Ctx = createContext<PlayerCtx>({ play: async () => {} });
export const usePlayer = () => useContext(Ctx);

declare global {
  interface Window {
    // biome-ignore lint/suspicious/noExplicitAny: external script global
    APlayer?: any;
    __aplayerLoading?: Promise<void>;
  }
}

function loadAPlayer(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.APlayer) return Promise.resolve();
  if (!window.__aplayerLoading) {
    window.__aplayerLoading = new Promise<void>((resolve, reject) => {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = "https://cdn.jsdelivr.net/npm/aplayer@1.10.1/dist/APlayer.min.css";
      document.head.appendChild(css);
      const js = document.createElement("script");
      js.src = "https://cdn.jsdelivr.net/npm/aplayer@1.10.1/dist/APlayer.min.js";
      js.onload = () => resolve();
      js.onerror = () => reject(new Error("APlayer load failed"));
      document.head.appendChild(js);
    });
  }
  return window.__aplayerLoading;
}

export async function fetchMeting(server: string, type: string, id: string): Promise<MetingSong[]> {
  const res = await fetch(`${METING_API}?server=${server}&type=${type}&id=${id}`);
  if (!res.ok) throw new Error(`meting ${res.status}`);
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? (data as MetingSong[]) : [];
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  // biome-ignore lint/suspicious/noExplicitAny: APlayer has no types
  const apRef = useRef<any>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        await loadAPlayer();
        if (dead || !boxRef.current || apRef.current) return;
        const audio = await fetchMeting("netease", "playlist", DEFAULT_PLAYLIST).catch(
          () => [] as MetingSong[],
        );
        if (dead || !boxRef.current || apRef.current) return;
        apRef.current = new window.APlayer({
          container: boxRef.current,
          fixed: true, // 左下角吸底模式
          audio,
          order: "random",
          volume: 0.3,
          listFolded: true,
          lrcType: 3,
          autoplay: false,
        });
      } catch {
        /* player unavailable — rows silently no-op */
      }
    })();
    return () => {
      dead = true;
      apRef.current?.destroy?.();
      apRef.current = null;
    };
  }, []);

  async function play(server: string, type: string, id: string) {
    try {
      const songs = await fetchMeting(server, type, id);
      const ap = apRef.current;
      if (!songs.length || !ap) return;
      ap.list.clear();
      ap.list.add(songs);
      ap.play();
    } catch {
      /* keep current playback */
    }
  }

  return (
    <Ctx.Provider value={{ play }}>
      {children}
      <div ref={boxRef} />
    </Ctx.Provider>
  );
}
