"use client";

/**
 * 右下角看板娘 — fixed to the bottom-right viewport edge site-wide, mirroring
 * the old blog's live2d-widget (waifu) placement.
 * 参考 autoload.js：<768px 彻底不初始化（引擎/模型都不加载），而非仅 CSS 隐藏。
 */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const Live2DMascot = dynamic(() => import("./live2d-mascot"), {
  ssr: false,
  loading: () => null,
});

export function MascotWidget() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    setEnabled(window.screen.width >= 768);
  }, []);
  if (!enabled) return null;
  return (
    <div className="fixed bottom-0 right-0 z-40">
      <Live2DMascot width={230} height={320} />
    </div>
  );
}
