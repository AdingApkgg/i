"use client";

import dynamic from "next/dynamic";

const Live2DMascot = dynamic(() => import("./live2d-mascot"), {
  ssr: false,
  loading: () => <div className="h-[360px] w-[260px] animate-pulse rounded-[var(--radius-lg)] bg-soft" />,
});

export function Mascot() {
  return (
    <div className="relative grid min-h-[360px] place-items-center overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: "radial-gradient(220px 260px at 50% 40%, var(--soft), transparent 70%)",
        }}
      />
      <Live2DMascot width={260} height={360} className="relative z-10" />
      <small className="absolute bottom-2 z-10 text-xs text-muted-foreground">看板娘 · Live2D</small>
    </div>
  );
}
