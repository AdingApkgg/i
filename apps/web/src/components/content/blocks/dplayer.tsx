import { cn } from "@i/ui";
import { isHLSProvider, MediaPlayer, MediaProvider, Poster } from "@vidstack/react";
import { DefaultVideoLayout, defaultLayoutIcons } from "@vidstack/react/player/layouts/default";
import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { videoTranslations } from "@/components/player/video-translations";

/** 保留旧标签名；媒体生命周期、HLS 和所有视频控制统一交给 Vidstack。 */
export function DPlayer({ url, pic }: { url: string; pic?: string }) {
  return <VideoPlayer key={url} url={url} pic={pic} />;
}

function VideoPlayer({ url, pic }: { url: string; pic?: string }) {
  // Vidstack 的交互布局依赖 DOM；SSR 和首次水合先保留等尺寸封面。
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const frame =
    "relative aspect-video w-full overflow-hidden rounded-[var(--radius-lg)] border border-border bg-black";
  return (
    <section aria-label="视频播放器" className={cn(frame, "my-5")}>
      {failed ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-soft text-center">
          <p className="text-sm text-muted-foreground">视频加载失败</p>
          <div className="flex items-center gap-3 text-sm text-primary">
            <button
              type="button"
              className="rounded-pill bg-card px-4 py-1.5"
              onClick={() => {
                setAttempt((n) => n + 1);
                setFailed(false);
              }}
            >
              重试
            </button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5"
            >
              <ExternalLink className="size-3.5" /> 在新窗口打开
            </a>
          </div>
        </div>
      ) : !mounted ? (
        pic ? (
          <img src={pic} alt="视频封面" className="size-full object-cover" />
        ) : null
      ) : (
        <MediaPlayer
          key={attempt}
          title="视频"
          src={/\.m3u8(?:[?#]|$)/i.test(url) ? { src: url, type: "application/x-mpegurl" } : url}
          poster={pic}
          viewType="video"
          load={attempt > 0 ? "eager" : "play"}
          preload="none"
          autoPlay={attempt > 0}
          playsInline
          onProviderChange={(provider) => {
            if (isHLSProvider(provider)) provider.library = () => import("hls.js");
          }}
          onError={() => setFailed(true)}
          className="h-full w-full"
        >
          <MediaProvider>
            <Poster className="vds-poster" alt="视频封面" />
          </MediaProvider>
          <DefaultVideoLayout icons={defaultLayoutIcons} translations={videoTranslations} />
        </MediaPlayer>
      )}
    </section>
  );
}
