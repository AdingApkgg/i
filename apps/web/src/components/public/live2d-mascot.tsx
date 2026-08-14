"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Camera, Info, Quote, Rocket, Shirt, Users, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Cubism2Mascot } from "@/lib/live2d/cubism2";
import {
  fetchHitokoto,
  fetchModelList,
  fetchTips,
  groupCostumes,
  type ModelList,
  modelSrc,
  pick,
  seasonGreeting,
  timeGreeting,
  WAIFU_LS,
  type WaifuTips,
} from "@/lib/live2d/waifu";

export interface Live2DMascotProps {
  width?: number;
  height?: number;
  className?: string;
}

/**
 * waifu 看板娘完整版（参考 AdingApkgg/live2d-api）：
 * 42 套明日奈换装 + 11 组换人（npmmirror CDN）、工具栏（一言/打飞机/换人/换装/
 * 拍照/信息/退出）、时段+节日问候、悬停吐槽、复制/控制台/切页彩蛋、退出记忆。
 * 渲染层为自实现 Cubism 2 引擎。
 */
export default function Live2DMascot({ width = 230, height = 320, className }: Live2DMascotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Cubism2Mascot | null>(null);
  const [list, setList] = useState<ModelList | null>(null);
  const tipsRef = useRef<WaifuTips | null>(null);
  const [hidden, setHidden] = useState<boolean | null>(null); // null = 未读取
  const [group, setGroup] = useState(0);
  const [costume, setCostume] = useState(0);
  const switching = useRef(false);

  // ---- 气泡（带优先级）----
  const [tip, setTip] = useState<string | null>(null);
  const tipPrio = useRef(0);
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showTip = useCallback((text: string | null | undefined, ms = 6000, prio = 1) => {
    if (!text) return;
    if (tipTimer.current && prio < tipPrio.current) return; // 低优先级不打断
    tipPrio.current = prio;
    setTip(text);
    if (tipTimer.current) clearTimeout(tipTimer.current);
    tipTimer.current = setTimeout(() => {
      setTip(null);
      tipPrio.current = 0;
    }, ms);
  }, []);

  // ---- 初始化：读 LS、拉 model_list + tips ----
  useEffect(() => {
    setHidden(localStorage.getItem(WAIFU_LS.hidden) === "1");
    void fetchModelList()
      .then((l) => {
        setList(l);
        const gRaw = localStorage.getItem(WAIFU_LS.group);
        const cRaw = localStorage.getItem(WAIFU_LS.costume);
        if (gRaw !== null && l.models[Number(gRaw)]) {
          const g = Number(gRaw);
          setGroup(g);
          setCostume(Math.min(Number(cRaw) || 0, groupCostumes(l, g).length - 1));
        } else {
          // 随机开场：未手动选择过 → 明日奈组随机一套装
          setCostume(Math.floor(Math.random() * groupCostumes(l, 0).length));
        }
      })
      .catch(() => {});
    void fetchTips()
      .then((t) => {
        tipsRef.current = t;
        showTip(seasonGreeting(t) ?? timeGreeting(t) ?? pick(t.message.default), 7000, 2);
      })
      .catch(() => {});
  }, [showTip]);

  // ---- 引擎生命周期 ----
  useEffect(() => {
    if (hidden !== false || !list) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    let engine: Cubism2Mascot | null = null;
    try {
      engine = new Cubism2Mascot(canvas);
    } catch {
      return;
    }
    engineRef.current = engine;
    const path = groupCostumes(list, group)[costume] ?? groupCostumes(list, 0)[0];
    if (path)
      void engine.load(modelSrc(path)).catch((e) => {
        console.warn("[waifu] model load failed:", e);
      });

    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      engineRef.current?.setGaze(
        (e.clientX - (r.left + r.width / 2)) / (window.innerWidth * 0.5),
        -(e.clientY - (r.top + r.height * 0.3)) / (window.innerHeight * 0.5),
      );
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      engine?.destroy();
      engineRef.current = null;
    };
    // 初次挂载后模型切换走 switchModel，不重建引擎
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden, list, width, height]);

  // ---- 换装/换人 ----
  const applyModel = useCallback(
    async (g: number, c: number, msg?: string) => {
      if (!list || switching.current) return;
      const path = groupCostumes(list, g)[c];
      if (!path) return;
      switching.current = true;
      try {
        await engineRef.current?.switchModel(modelSrc(path));
        setGroup(g);
        setCostume(c);
        localStorage.setItem(WAIFU_LS.group, String(g));
        localStorage.setItem(WAIFU_LS.costume, String(c));
        if (msg) showTip(msg, 5000, 2);
      } finally {
        switching.current = false;
      }
    },
    [list, showTip],
  );

  const switchCostume = useCallback(() => {
    if (!list) return;
    const n = groupCostumes(list, group).length;
    if (n <= 1) {
      showTip("我还没有其他衣服呢～", 4000, 2);
      return;
    }
    void applyModel(group, (costume + 1) % n, "我的新衣服好看嘛？");
  }, [list, group, costume, applyModel, showTip]);

  const switchGroup = useCallback(() => {
    if (!list) return;
    const g = (group + 1) % list.models.length;
    void applyModel(g, 0, list.messages[g] ?? "新朋友来啦～");
  }, [list, group, applyModel]);

  // ---- 拍照 ----
  const takePhoto = useCallback(async () => {
    const url = await engineRef.current?.takePhoto();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = "waifu.png";
    a.click();
    showTip("照好了嘛，是不是很可爱呢？", 5000, 2);
  }, [showTip]);

  // ---- 打飞机彩蛋 ----
  const startAsteroids = useCallback(() => {
    const s = document.createElement("script");
    s.src = "/live2d/asteroids.js";
    document.body.appendChild(s);
    showTip("准备好了吗？方向键移动，空格发射！", 5000, 2);
  }, [showTip]);

  // ---- 一言（空闲低优先级）----
  const showHitokoto = useCallback(async () => {
    const t = await fetchHitokoto();
    if (t) showTip(t, 7000, 1);
  }, [showTip]);
  useEffect(() => {
    if (hidden !== false) return;
    const timer = setInterval(() => {
      if (!document.hidden && !tipTimer.current) void showHitokoto();
    }, 45_000);
    return () => clearInterval(timer);
  }, [hidden, showHitokoto]);

  // ---- 悬停吐槽 + 复制/切页/控制台彩蛋 ----
  useEffect(() => {
    if (hidden !== false) return;
    let lastSel = "";
    const onOver = (e: MouseEvent) => {
      const tips = tipsRef.current;
      const target = e.target as Element | null;
      if (!tips || !target?.closest) return;
      for (const m of tips.mouseover) {
        const el = target.closest(m.selector);
        if (!el) continue;
        if (m.selector === lastSel) return; // 同一目标不刷屏
        lastSel = m.selector;
        let text = pick(m.text);
        text = text.replace("{text}", (el.textContent ?? "").trim().slice(0, 14));
        showTip(text.replace(/<[^>]+>/g, ""), 4000, 1);
        return;
      }
      lastSel = "";
    };
    const onCopy = () => showTip(tipsRef.current?.message.copy, 5000, 3);
    const onVis = () => {
      if (!document.hidden) showTip(tipsRef.current?.message.visibilitychange, 5000, 3);
    };
    document.addEventListener("mouseover", onOver, { passive: true });
    document.addEventListener("copy", onCopy);
    document.addEventListener("visibilitychange", onVis);
    // 控制台检测（窗口内外尺寸差）
    let warned = false;
    const devtools = setInterval(() => {
      if (warned) return;
      if (
        window.outerWidth - window.innerWidth > 200 ||
        window.outerHeight - window.innerHeight > 200
      ) {
        warned = true;
        showTip(tipsRef.current?.message.console, 6000, 3);
      }
    }, 2500);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(devtools);
    };
  }, [hidden, showTip]);

  // ---- 点击看板娘 ----
  function onTap(e: React.MouseEvent<HTMLCanvasElement>) {
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine || !canvas) return;
    const r = canvas.getBoundingClientRect();
    engine.tap(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
    const click = tipsRef.current?.click[0];
    if (click) showTip(pick(click.text), 4000, 2);
  }

  function quit() {
    localStorage.setItem(WAIFU_LS.hidden, "1");
    setHidden(true);
    setTip(null);
  }
  function restore() {
    localStorage.setItem(WAIFU_LS.hidden, "0");
    setHidden(false);
  }

  if (hidden === null) return null;
  if (hidden) {
    return (
      <motion.button
        type="button"
        onClick={restore}
        title="召唤看板娘"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        className="pointer-events-auto grid size-9 place-items-center rounded-full border border-border bg-card/90 text-primary shadow-md backdrop-blur transition hover:scale-110"
      >
        ✿
      </motion.button>
    );
  }

  const tools: { id: string; icon: React.ReactNode; label: string; onClick: () => void }[] = [
    { id: "hitokoto", icon: <Quote className="size-3.5" />, label: "一言", onClick: () => void showHitokoto() },
    { id: "asteroids", icon: <Rocket className="size-3.5" />, label: "打飞机", onClick: startAsteroids },
    { id: "switch-model", icon: <Users className="size-3.5" />, label: "换人", onClick: switchGroup },
    { id: "switch-texture", icon: <Shirt className="size-3.5" />, label: "换装", onClick: switchCostume },
    { id: "photo", icon: <Camera className="size-3.5" />, label: "拍照", onClick: () => void takePhoto() },
    {
      id: "info",
      icon: <Info className="size-3.5" />,
      label: "关于",
      onClick: () => window.open("https://github.com/AdingApkgg/live2d-api", "_blank"),
    },
    { id: "quit", icon: <X className="size-3.5" />, label: "再见", onClick: quit },
  ];

  return (
    <motion.div
      className={`group/waifu pointer-events-auto ${className ?? ""}`}
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
            className="absolute -top-4 left-1/2 z-10 w-max max-w-[240px] -translate-x-1/2 rounded-[var(--radius-md)] border border-border bg-card/95 px-3 py-1.5 text-center text-xs text-foreground shadow-md backdrop-blur"
            style={{ lineHeight: 1.6 }}
          >
            {tip}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 工具栏：悬停看板娘时出现 */}
      <div className="absolute -left-7 top-10 z-10 flex flex-col gap-1 opacity-0 transition-opacity duration-300 group-hover/waifu:opacity-100">
        {tools.map((t) => (
          <button
            key={t.id}
            id={`waifu-tool-${t.id}`}
            type="button"
            title={t.label}
            onClick={t.onClick}
            className="grid size-6 place-items-center rounded-full border border-border bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition hover:scale-110 hover:text-primary"
          >
            {t.icon}
          </button>
        ))}
      </div>

      <canvas
        id="waifu-canvas"
        ref={canvasRef}
        onClick={onTap}
        style={{ width: "100%", height: "100%", background: "transparent", cursor: "pointer" }}
      />
    </motion.div>
  );
}
