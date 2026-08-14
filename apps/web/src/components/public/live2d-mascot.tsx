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
  idlePool,
  type ModelList,
  modelSrc,
  pick,
  WAIFU_LS,
  type WaifuTips,
  welcomeMessage,
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
        // 参考实现语义：首页时段问候；其它页欢迎阅读标题；外站 referrer 来源问候
        showTip(welcomeMessage(t), 7000, 2);
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

  // ---- 一言（正文 + 出处补充两连）----
  const showHitokoto = useCallback(async () => {
    const h = await fetchHitokoto();
    if (!h) return;
    showTip(h.text, 6000, 1);
    if (h.followup) {
      setTimeout(() => showTip(h.followup, 4000, 1), 6000);
    }
  }, [showTip]);

  // ---- 空闲吐槽：default 消息池(含节日) 与一言轮换 ----
  useEffect(() => {
    if (hidden !== false) return;
    const timer = setInterval(() => {
      if (document.hidden || tipTimer.current) return;
      const tips = tipsRef.current;
      if (tips && Math.random() < 0.7) {
        showTip(pick(idlePool(tips)), 6000, 1);
      } else {
        void showHitokoto();
      }
    }, 40_000);
    return () => clearInterval(timer);
  }, [hidden, showHitokoto, showTip]);

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
    // 全局 click 吐槽（含点击看板娘/评论框；动作插播由 canvas onTap 负责）
    const onClick = (e: MouseEvent) => {
      const tips = tipsRef.current;
      const target = e.target as Element | null;
      if (!tips || !target?.closest) return;
      for (const c of tips.click) {
        if (!target.closest(c.selector)) continue;
        showTip(pick(c.text).replace(/<[^>]+>/g, ""), 4000, 2);
        return;
      }
    };
    const onCopy = () => showTip(tipsRef.current?.message.copy, 5000, 3);
    const onVis = () => {
      if (!document.hidden) showTip(tipsRef.current?.message.visibilitychange, 5000, 3);
    };
    document.addEventListener("mouseover", onOver, { passive: true });
    document.addEventListener("click", onClick);
    document.addEventListener("copy", onCopy);
    document.addEventListener("visibilitychange", onVis);
    // 控制台检测：console.log("%c", trap) + toString 陷阱 —— DevTools 渲染日志时才触发
    let warned = false;
    const trap = {
      toString: () => {
        if (!warned) {
          warned = true;
          showTip(tipsRef.current?.message.console, 6000, 3);
        }
        return "";
      },
    };
    console.log("%c", trap);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("click", onClick);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [hidden, showTip]);

  // ---- 点击看板娘（动作插播；文案由全局 click 监听统一处理）----
  function onTap(e: React.MouseEvent<HTMLCanvasElement>) {
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine || !canvas) return;
    const r = canvas.getBoundingClientRect();
    engine.tap(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
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
