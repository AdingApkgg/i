"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Cubism2Mascot } from "@/lib/live2d/cubism2";

const DEFAULT_SRC = "/live2d/asuna/asuna_01/index.json";

const HIT_TIPS: Record<string, string[]> = {
  head: ["呀！不要摸头啦 (。>﹏<。)", "头发要乱了啦~", "嘿嘿，舒服~"],
  body: ["再戳就生气了哦！", "有、有什么事吗？", "嗯？找我玩吗？"],
  default: ["✿ 欢迎来到后花园~", "今天也要加油哦！", "呀！戳我干嘛~"],
};

export interface Live2DMascotProps {
  src?: string;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Live2D 看板娘 — 自实现 Cubism 2 引擎（lib/live2d/cubism2.ts），零 loader 依赖：
 * 全页鼠标跟随 + 命中区点击动作(.mtn 真动作) + 空闲随机 idle + 物理摆动 +
 * ≥2x 超采样清晰度。气泡与入场动画走 framer-motion。
 */
export default function Live2DMascot({
  src = DEFAULT_SRC,
  width = 230,
  height = 320,
  className,
}: Live2DMascotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Cubism2Mascot | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // 始终 ≥2x 超采样，1x 屏也保持锐利
    const scale = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    let engine: Cubism2Mascot | null = null;
    try {
      engine = new Cubism2Mascot(canvas);
    } catch {
      return; // WebGL 不可用
    }
    engineRef.current = engine;
    void engine.load(src).catch(() => {});

    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.3; // 以头部高度为原点
      engineRef.current?.setGaze(
        (e.clientX - cx) / (window.innerWidth * 0.5),
        -(e.clientY - cy) / (window.innerHeight * 0.5),
      );
    };
    window.addEventListener("mousemove", onMove, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onMove);
      engine?.destroy();
      engineRef.current = null;
    };
  }, [src, width, height]);

  function onTap(e: React.MouseEvent<HTMLCanvasElement>) {
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine || !canvas) return;
    const r = canvas.getBoundingClientRect();
    const { hitArea } = engine.tap(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
    const pool = HIT_TIPS[hitArea ?? "default"] ?? HIT_TIPS.default!;
    setTip(pool[Math.floor(Math.random() * pool.length)]!);
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => setTip(null), 3500);
  }

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
      <canvas
        ref={canvasRef}
        onClick={onTap}
        style={{ width: "100%", height: "100%", background: "transparent", cursor: "pointer" }}
      />
    </motion.div>
  );
}
