"use client";

import { Cubism2Adapter } from "@live2d-loader/adapter-cubism2";
import type { Live2DModelElement } from "@live2d-loader/element";
import { useEffect, useRef } from "react";

const DEFAULT_SRC = "/live2d/asuna/asuna_01/index.json";

export interface Live2DMascotProps {
  src?: string;
  width?: number;
  height?: number;
  className?: string;
  interactive?: boolean;
}

/** Live2D mascot via the user's own @live2d-loader (Cubism 2). SSR-safe. */
export default function Live2DMascot({
  src = DEFAULT_SRC,
  width = 260,
  height = 360,
  className,
  interactive = false,
}: Live2DMascotProps) {
  const ref = useRef<Live2DModelElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    void import("@live2d-loader/element");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const configure = () => {
      if (cancelled || !ref.current) return;
      ref.current.configure({ adapters: [new Cubism2Adapter()] });
    };
    if (window.customElements?.get("live2d-model")) configure();
    else window.customElements?.whenDefined("live2d-model").then(configure).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div
      className={className}
      style={{
        width,
        height,
        pointerEvents: interactive ? "auto" : "none",
        userSelect: "none",
        lineHeight: 0,
      }}
      aria-hidden={!interactive}
    >
      <live2d-model
        ref={ref}
        src={src}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      />
    </div>
  );
}
