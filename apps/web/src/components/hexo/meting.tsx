"use client";

import { createElement, useEffect, useState } from "react";

const APLAYER_CSS = "https://cdn.jsdelivr.net/npm/aplayer@1.10.1/dist/APlayer.min.css";
const APLAYER_JS = "https://cdn.jsdelivr.net/npm/aplayer@1.10.1/dist/APlayer.min.js";
const METING_JS = "https://cdn.jsdelivr.net/npm/meting@2/dist/Meting.min.js";
const METING_API = "https://api.injahow.cn/meting/?server=:server&type=:type&id=:id";

declare global {
  interface Window {
    APlayer?: unknown;
    MetingJSElement?: unknown;
    meting_api?: string;
  }
}

function loadCssOnce(href: string) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error(`failed: ${src}`)));
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    });
    script.addEventListener("error", () => reject(new Error(`failed: ${src}`)));
    document.head.appendChild(script);
  });
}

/**
 * 内嵌 meting-js 音乐播放器。首次挂载时按需(幂等)注入 APlayer + MetingJS 资源,
 * 随后渲染 <meting-js> 自定义元素。脚本加载失败时回退到网易云链接。
 */
export function Meting({ server, type, mid }: { server?: string; type?: string; mid?: string }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const srv = server || "netease";
  const kind = type || "song";

  useEffect(() => {
    let cancelled = false;
    // 全局 meting API(供 MetingJS 读取)
    window.meting_api = METING_API;
    loadCssOnce(APLAYER_CSS);

    const boot = async () => {
      try {
        await loadScriptOnce(APLAYER_JS);
        await loadScriptOnce(METING_JS);
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    };
    void boot();

    return () => {
      cancelled = true;
    };
  }, []);

  const frame =
    "w-full overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card";

  if (failed) {
    return (
      <div className={`${frame} flex items-center justify-between gap-3 px-4 py-3`}>
        <span className="text-sm text-muted-foreground">音乐播放器加载失败</span>
        <a
          href={`https://music.163.com/#/song?id=${mid ?? ""}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-pill bg-soft px-3 py-1 text-sm text-primary"
        >
          去网易云收听
        </a>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className={`${frame} px-4 py-4 text-sm text-muted-foreground`}>正在加载播放器…</div>
    );
  }

  // <meting-js> 是带连字符的自定义元素,须用 createElement 渲染
  return (
    <div className={frame}>
      {createElement("meting-js", {
        id: mid,
        server: srv,
        type: kind,
        api: METING_API,
      })}
    </div>
  );
}
