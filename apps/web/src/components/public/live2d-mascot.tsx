"use client";

import { Cubism2Adapter } from "@live2d-loader/adapter-cubism2";
import type { Live2DModelElement } from "@live2d-loader/element";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

const DEFAULT_SRC = "/live2d/asuna/asuna_01/index.json";

const HIT_TIPS = [
  "呀！戳我干嘛~ (。>﹏<。)",
  "有、有什么事吗？",
  "再戳就生气了哦！",
  "✿ 欢迎来到后花园~",
  "嗯？找我玩吗？",
];

/** Minimal surface of the Cubism 2 core model we poke at. */
interface Cubism2Core {
  setParamFloat(id: string, value: number): void;
  loadParam(): void;
  __gazeHooked?: boolean;
}

export interface Live2DMascotProps {
  src?: string;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Live2D mascot via the user's own @live2d-loader (Cubism 2), upgraded with:
 * - 全页鼠标跟随: window mousemove drives gaze params (the published adapter
 *   records pointerX but doesn't consume it, so we inject via an updateModel
 *   wrapper — set before the adapter's saveParam so its idle sway stacks on top)
 * - 点击反应: hit event → head-shake impulse + chat bubble
 * - 清晰度: canvas rendered at devicePixelRatio (≤2), CSS-scaled down
 */
export default function Live2DMascot({
  src = DEFAULT_SRC,
  width = 230,
  height = 320,
  className,
}: Live2DMascotProps) {
  const ref = useRef<Live2DModelElement>(null);
  const gaze = useRef({ x: 0, y: 0, impulse: 0 });
  const [dpr, setDpr] = useState(1);
  const [tip, setTip] = useState<string | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Always supersample ≥2x — at 1x-DPR screens the raw canvas looks soft.
    setDpr(Math.min(Math.max(window.devicePixelRatio || 1, 2), 3));
    void import("@live2d-loader/element");
  }, []);

  // Configure with a gaze-injecting adapter wrapper once the element upgrades.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const configure = () => {
      const el = ref.current;
      if (cancelled || !el) return;
      const adapter = new Cubism2Adapter();
      const orig = adapter.updateModel.bind(adapter);
      adapter.updateModel = (model, dt) => {
        const cm = (model as { coreModel?: unknown }).coreModel as Cubism2Core | undefined;
        // The adapter's update starts with cm.loadParam(), which restores the
        // saved snapshot and wipes anything set before the call. Hook loadParam
        // once so gaze params land right after the restore — inside the
        // pipeline, before saveParam — letting the adapter's idle sway
        // (addToParamFloat) stack on top.
        if (cm?.setParamFloat && !cm.__gazeHooked) {
          cm.__gazeHooked = true;
          const origLoad = cm.loadParam.bind(cm);
          cm.loadParam = () => {
            origLoad();
            const g = gaze.current;
            g.impulse *= 0.93; // decay the tap head-shake
            cm.setParamFloat("PARAM_ANGLE_X", g.x * 30);
            cm.setParamFloat("PARAM_ANGLE_Y", g.y * 30);
            cm.setParamFloat("PARAM_ANGLE_Z", g.impulse * 18 * Math.sin(Date.now() / 60));
            cm.setParamFloat("PARAM_BODY_ANGLE_X", g.x * 10);
            cm.setParamFloat("PARAM_EYE_BALL_X", g.x);
            cm.setParamFloat("PARAM_EYE_BALL_Y", g.y);
          };
        }
        orig(model, dt);
      };
      el.configure({ adapters: [adapter] });
    };
    if (window.customElements?.get("live2d-model")) configure();
    else
      window.customElements
        ?.whenDefined("live2d-model")
        .then(configure)
        .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // 全页鼠标跟随 + 点击反应.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.35; // aim from head height
      gaze.current.x = Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth * 0.5)));
      gaze.current.y = Math.max(-1, Math.min(1, -(e.clientY - cy) / (window.innerHeight * 0.5)));
    };
    window.addEventListener("mousemove", onMove, { passive: true });

    const onHit = () => {
      gaze.current.impulse = 1;
      const t = HIT_TIPS[Math.floor(Math.random() * HIT_TIPS.length)]!;
      setTip(t);
      if (tipTimer.current) clearTimeout(tipTimer.current);
      tipTimer.current = setTimeout(() => setTip(null), 3500);
    };
    el.addEventListener("hit", onHit);

    return () => {
      window.removeEventListener("mousemove", onMove);
      el.removeEventListener("hit", onHit);
      if (tipTimer.current) clearTimeout(tipTimer.current);
    };
  }, []);

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 18, delay: 0.15 }}
      style={{ width, height, position: "relative", userSelect: "none", lineHeight: 0 }}
    >
      <AnimatePresence>
        {tip && (
          <motion.div
            key={tip}
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
            className="absolute -top-2 left-1/2 z-10 w-max max-w-[220px] -translate-x-1/2 rounded-[var(--radius-md)] border border-border bg-card/95 px-3 py-1.5 text-center text-xs text-foreground shadow-md backdrop-blur"
            style={{ lineHeight: 1.5 }}
          >
            {tip}
          </motion.div>
        )}
      </AnimatePresence>
      <live2d-model
        ref={ref}
        src={src}
        width={Math.round(width * dpr)}
        height={Math.round(height * dpr)}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      />
    </motion.div>
  );
}
