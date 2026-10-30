/**
 * 右下角看板娘 — fixed to the bottom-right viewport edge site-wide, mirroring
 * the old blog's live2d-widget (waifu) placement.
 * 参考 autoload.js：<768px 彻底不初始化（引擎/模型都不加载），而非仅 CSS 隐藏。
 */
import { lazy, Suspense, useEffect, useState } from "react";

// 只在浏览器里按需加载（enabled 初始为 false，SSR 时不会渲染它）
const Live2DMascot = lazy(() => import("./live2d-mascot"));

export function MascotWidget() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    setEnabled(window.screen.width >= 768);
  }, []);
  if (!enabled) return null;
  return (
    <div className="fixed right-0 bottom-[var(--site-nav-height)] z-40 lg:bottom-0">
      <Suspense fallback={null}>
        <Live2DMascot width={230} height={320} />
      </Suspense>
    </div>
  );
}
