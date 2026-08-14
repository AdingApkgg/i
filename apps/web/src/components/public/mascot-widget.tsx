"use client";

/**
 * 右下角看板娘 — fixed to the bottom-right viewport edge site-wide, mirroring
 * the old blog's live2d-widget (waifu) placement. Desktop only; never blocks
 * clicks (pointer-events: none).
 */
import dynamic from "next/dynamic";

const Live2DMascot = dynamic(() => import("./live2d-mascot"), {
  ssr: false,
  loading: () => null,
});

export function MascotWidget() {
  return (
    <div className="fixed bottom-0 right-0 z-40 hidden md:block">
      <Live2DMascot width={230} height={320} />
    </div>
  );
}
