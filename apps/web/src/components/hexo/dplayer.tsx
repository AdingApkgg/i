"use client";

import { cn } from "@i/ui";
import { useEffect, useRef, useState } from "react";

/**
 * 懒加载 HLS (.m3u8) 视频播放器。
 * 先展示封面 + ▶ 播放按钮，点击后才挂载 <video> 并接入 hls.js。
 */
export function DPlayer({ url, pic }: { url: string; pic?: string }) {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!playing) return;
    const video = videoRef.current;
    if (!video) return;

    let hls: { destroy: () => void } | null = null;
    let cancelled = false;

    const attach = async () => {
      try {
        if (url.endsWith(".m3u8")) {
          const { default: Hls } = await import("hls.js");
          if (cancelled) return;
          if (Hls.isSupported()) {
            const instance = new Hls();
            hls = instance;
            instance.on(Hls.Events.ERROR, (_e, data) => {
              if (data?.fatal) setFailed(true);
            });
            instance.loadSource(url);
            instance.attachMedia(video);
            return;
          }
        }
        // 原生 HLS(Safari/iOS)或普通视频源
        video.src = url;
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    void attach();

    return () => {
      cancelled = true;
      if (hls) {
        try {
          hls.destroy();
        } catch {
          /* noop */
        }
      }
    };
  }, [playing, url]);

  const frame =
    "relative aspect-video w-full overflow-hidden rounded-[var(--radius-lg)] border border-border bg-soft";

  if (failed) {
    return (
      <div className={cn(frame, "flex flex-col items-center justify-center gap-2 text-center")}>
        <p className="text-sm text-muted-foreground">视频加载失败</p>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="rounded-pill bg-card px-4 py-1.5 text-sm text-primary"
        >
          在新窗口打开
        </a>
      </div>
    );
  }

  if (!playing) {
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        aria-label="播放视频"
        className={cn(frame, "group block cursor-pointer")}
      >
        {pic ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pic}
            alt="视频封面"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-soft" />
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors group-hover:bg-black/35">
          <span className="flex h-16 w-16 items-center justify-center rounded-pill bg-card/90 text-primary shadow-lg backdrop-blur transition-transform group-hover:scale-110">
            <svg
              viewBox="0 0 24 24"
              className="ml-1 h-7 w-7"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
      </button>
    );
  }

  return (
    <video
      ref={videoRef}
      controls
      autoPlay
      playsInline
      poster={pic}
      onError={() => setFailed(true)}
      className={cn(frame, "bg-black")}
    >
      <track kind="captions" />
    </video>
  );
}
