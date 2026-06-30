"use client";

import { useEffect, useRef } from "react";
import type { Live2DModelElement } from "@live2d-loader/element";
import { Cubism2Adapter } from "@live2d-loader/adapter-cubism2";

const DEFAULT_SRC = "/live2d/asuna/asuna_01/index.json";

export interface Live2DMascotProps {
  /** Entry index.json of the Cubism 2 model. Defaults to the bundled asuna model. */
  src?: string;
  width?: number;
  height?: number;
  className?: string;
  /** When false (default) the mascot never intercepts pointer events / layout. */
  interactive?: boolean;
}

/**
 * Live2D mascot rendered via the user's own published loader
 * (@live2d-loader/*). Uses the <live2d-model> web component with the
 * Cubism 2 adapter.
 *
 * SSR-safe: the custom-element module is imported lazily inside an effect, so
 * nothing browser-only runs during server render. The intended consumption is
 * still through next/dynamic({ ssr: false }) (see manifest), but the component
 * guards browser APIs on its own as well.
 */
export default function Live2DMascot({
  src = DEFAULT_SRC,
  width = 280,
  height = 380,
  className,
  interactive = false,
}: Live2DMascotProps) {
  const ref = useRef<Live2DModelElement>(null);

  // Register the custom element (browser-only) after mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    void import("@live2d-loader/element");
  }, []);

  // Configure adapters once the element upgrades.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = ref.current;
    if (!el) return;

    let cancelled = false;

    const configure = () => {
      if (cancelled || !ref.current) return;
      ref.current.configure({ adapters: [new Cubism2Adapter()] });
    };

    // Wait for the custom element to be defined/upgraded before configuring.
    if (window.customElements?.get("live2d-model")) {
      configure();
    } else {
      window.customElements
        ?.whenDefined("live2d-model")
        .then(configure)
        .catch(() => {
          /* element module failed to load; nothing to configure */
        });
    }

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
        // Never block layout/interaction of the page unless explicitly enabled.
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
