import { cn } from "@i/ui";
import { I18nProvider } from "@videojs/react";
import zhCN from "@videojs/react/i18n/locales/zh-CN";
import { HlsJsVideo } from "@videojs/react/media/hlsjs-video";
import { VideoPlayer as MediaPlayer, Video, VideoSkin } from "@videojs/react/video";
import { ExternalLink, Play } from "lucide-react";
import { useState } from "react";

/** 保留旧富文本标签；视频和 HLS 均使用 Video.js 10。 */
export function DPlayer({ url, pic }: { url: string; pic?: string }) {
  return <VideoPlayer key={url} url={url} pic={pic} />;
}

function VideoPlayer({ url, pic }: { url: string; pic?: string }) {
  // 点击前不挂载媒体：HLS 引擎也不能提前请求 manifest。
  const [started, setStarted] = useState(false);
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
      ) : !started ? (
        <button
          type="button"
          aria-label="播放视频"
          className="relative grid size-full place-items-center"
          onClick={() => setStarted(true)}
        >
          {pic && (
            <img src={pic} alt="视频封面" className="absolute inset-0 size-full object-cover" />
          )}
          <span className="relative grid size-14 place-items-center rounded-full bg-black/55 text-white">
            <Play className="size-7 fill-current" />
          </span>
        </button>
      ) : (
        <I18nProvider locale="zh-CN" translations={zhCN}>
          <MediaPlayer key={attempt} title="视频" poster={pic}>
            <VideoSkin className="article-video h-full w-full">
              {/\.m3u8(?:[?#]|$)/i.test(url) ? (
                <HlsJsVideo
                  src={url}
                  autoPlay
                  playsInline
                  preload="none"
                  onError={() => setFailed(true)}
                />
              ) : (
                <Video
                  src={url}
                  autoPlay
                  playsInline
                  preload="none"
                  onError={() => setFailed(true)}
                />
              )}
            </VideoSkin>
          </MediaPlayer>
        </I18nProvider>
      )}
    </section>
  );
}
