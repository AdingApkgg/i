import {
  Cubism2Mascot,
  fetchHitokoto,
  fetchModelList,
  fetchTips,
  groupCostumes,
  idlePool,
  type ModelList,
  modelSrc,
  pick,
  WAIFU_SAY_EVENT,
  type WaifuTips,
  welcomeMessage,
} from "@i/live2d";
import { Camera, Info, Quote, Rocket, Settings, Shirt, Users, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useMascotStore } from "@/stores/mascot";
import "./mascot-dock.css";

export interface Live2DMascotProps {
  width?: number;
  height?: number;
  className?: string;
}

/**
 * waifu 看板娘完整版（参考 AdingApkgg/live2d-api）：
 * 42 套明日奈换装 + 11 组换人（仓内 @i/live2d 资源）、工具栏（一言/打飞机/换人/换装/
 * 拍照/信息/退出）、时段+节日问候、悬停吐槽、复制/控制台/切页彩蛋、退出记忆。
 * 渲染层为仓内维护的 Cubism 2 封装，底层仍使用自托管的第三方 Core。
 */
export default function Live2DMascot({ width = 230, height = 320, className }: Live2DMascotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Cubism2Mascot | null>(null);
  const [list, setList] = useState<ModelList | null>(null);
  const tipsRef = useRef<WaifuTips | null>(null);
  // 偏好在 stores/mascot.ts（持久化）；null = 还没从 localStorage 读出来
  const hidden = useMascotStore((s) => (s.ready ? s.hidden : null));
  const { pathname } = useLocation();
  const previousPathname = useRef(pathname);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const recallRef = useRef<HTMLButtonElement>(null);
  const focusAfterPreference = useRef(false);
  const [interactive, setInteractive] = useState(false);
  const [nativePopover, setNativePopover] = useState(false);

  const closePanel = useCallback((returnFocus = true) => {
    const panel = panelRef.current;
    if (panel?.popover && panel.matches(":popover-open")) panel.hidePopover();
    setInteractive(false);
    if (returnFocus) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    setNativePopover(typeof HTMLElement.prototype.showPopover === "function");
  }, []);

  useLayoutEffect(() => {
    if (!interactive) return;
    if (nativePopover) panelRef.current?.showPopover({ source: triggerRef.current ?? undefined });
    closeRef.current?.focus({ preventScroll: true });
  }, [interactive, nativePopover]);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    closePanel(false);
  }, [pathname, closePanel]);

  // 不支持原生 popover 时仍可点击、Escape 关闭；面板不设为模态、不锁住页面。
  useEffect(() => {
    if (!interactive || nativePopover) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closePanel();
    };
    const onOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target))
        closePanel(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutside);
    };
  }, [interactive, nativePopover, closePanel]);

  useEffect(() => {
    if (!focusAfterPreference.current) return;
    focusAfterPreference.current = false;
    (hidden ? recallRef : triggerRef).current?.focus({ preventScroll: true });
  }, [hidden]);

  // 只给首页文章窗、下方两栏和页脚留泊位，不改主立绘或身份区。
  useEffect(() => {
    if (hidden !== false || pathname !== "/") return;
    const main = document.querySelector<HTMLElement>(".public-main-home");
    if (!main) return;
    const update = () => {
      // 泊位从内容右缘量起：清除量就是阅读内容还需让出的宽度。
      const gap = innerWidth - main.getBoundingClientRect().right;
      main.style.setProperty("--mascot-clearance", `${Math.max(0, 242 - gap)}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(main);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      main.style.removeProperty("--mascot-clearance");
    };
  }, [hidden, pathname]);

  const [group, setGroup] = useState(0);
  const [costume, setCostume] = useState(0);
  // 无 WebGL 时引擎构造抛错：退回静帧，别留一块空画布和一段白白让出的泊位。
  const [engineFailed, setEngineFailed] = useState(false);
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

  // ---- 初始化：读偏好、拉 model_list + tips ----
  useEffect(() => {
    // localStorage 是同步的：rehydrate 返回前偏好就已读好
    void useMascotStore.persist.rehydrate();
    void fetchModelList()
      .then((l) => {
        setList(l);
        const saved = useMascotStore.getState();
        if (saved.group !== null && l.models[saved.group]) {
          setGroup(saved.group);
          setCostume(Math.min(saved.costume, groupCostumes(l, saved.group).length - 1));
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
  // 初次挂载后模型切换走 switchModel，不重建引擎，故不依赖 group/costume
  // biome-ignore lint/correctness/useExhaustiveDependencies: 见上
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
      setEngineFailed(true);
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
        useMascotStore.getState().choose(g, c);
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
    const onSay = (e: Event) => showTip((e as CustomEvent<string>).detail, 7000, 3);
    const onVis = () => {
      if (!document.hidden) showTip(tipsRef.current?.message.visibilitychange, 5000, 3);
    };
    document.addEventListener("mouseover", onOver, { passive: true });
    document.addEventListener("click", onClick);
    document.addEventListener("copy", onCopy);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(WAIFU_SAY_EVENT, onSay);
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
      window.removeEventListener(WAIFU_SAY_EVENT, onSay);
    };
  }, [hidden, showTip]);

  // ---- 点击看板娘（动作插播；文案由全局 click 监听统一处理）----
  function onTap(e: React.MouseEvent<HTMLButtonElement>) {
    const engine = engineRef.current;
    const canvas = canvasRef.current;
    if (!engine || !canvas) return;
    const r = canvas.getBoundingClientRect();
    // 原生按钮为键盘/辅助技术合成的点击没有坐标，使用人物中心。
    engine.tap(
      e.detail ? e.clientX - r.left : r.width / 2,
      e.detail ? e.clientY - r.top : r.height * 0.35,
      r.width,
      r.height,
    );
  }

  function quit() {
    closePanel(false);
    focusAfterPreference.current = true;
    useMascotStore.getState().hide();
    setTip(null);
  }
  function restore() {
    focusAfterPreference.current = true;
    useMascotStore.getState().show();
  }

  if (hidden === null) return null;
  if (hidden) {
    return (
      <div className="mascot-dock" data-visible="false">
        <motion.button
          ref={recallRef}
          type="button"
          onClick={restore}
          title="召唤看板娘"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mascot-recall pointer-events-auto grid place-items-center rounded-full border border-border bg-card/90 text-primary shadow-md backdrop-blur"
        >
          ✿
        </motion.button>
      </div>
    );
  }

  const tools: { id: string; icon: React.ReactNode; label: string; onClick: () => void }[] = [
    {
      id: "hitokoto",
      icon: <Quote className="size-3.5" />,
      label: "一言",
      onClick: () => void showHitokoto(),
    },
    {
      id: "asteroids",
      icon: <Rocket className="size-3.5" />,
      label: "打飞机",
      onClick: startAsteroids,
    },
    {
      id: "switch-model",
      icon: <Users className="size-3.5" />,
      label: "换人",
      onClick: switchGroup,
    },
    {
      id: "switch-texture",
      icon: <Shirt className="size-3.5" />,
      label: "换装",
      onClick: switchCostume,
    },
    {
      id: "photo",
      icon: <Camera className="size-3.5" />,
      label: "拍照",
      onClick: () => void takePhoto(),
    },
    {
      id: "info",
      icon: <Info className="size-3.5" />,
      label: "关于",
      onClick: () => window.open("/live2d/NOTICE.txt", "_blank", "noopener,noreferrer"),
    },
    { id: "quit", icon: <X className="size-3.5" />, label: "再见", onClick: quit },
  ];

  return (
    <div className="mascot-dock" data-visible="true">
      <button
        ref={triggerRef}
        type="button"
        className="mascot-trigger"
        aria-label="看板娘工具与互动"
        aria-haspopup="dialog"
        aria-controls="mascot-tools-panel"
        aria-expanded={interactive}
        onClick={() => (interactive ? closePanel() : setInteractive(true))}
      >
        <Settings size={16} aria-hidden="true" />
        <span>人物</span>
      </button>
      <section
        ref={panelRef}
        id="mascot-tools-panel"
        className="mascot-panel"
        data-interactive={interactive}
        popover={interactive && nativePopover ? "auto" : undefined}
        role={interactive ? "dialog" : undefined}
        aria-label="看板娘工具与互动"
        onToggle={(event) => {
          // Escape / light-dismiss 由浏览器关闭；不抢走外部链接或表单的焦点。
          if (event.newState === "closed" && !event.currentTarget.matches(":popover-open"))
            setInteractive(false);
        }}
      >
        <header className="mascot-panel-heading" hidden={!interactive}>
          <h2>看板娘</h2>
          <button
            ref={closeRef}
            type="button"
            aria-label="关闭互动面板"
            onClick={() => closePanel()}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <motion.div
          className={`mascot-frame ${className ?? ""}`}
          data-engine={engineFailed ? "fallback" : "live2d"}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 120, damping: 18, delay: 0.15 }}
          style={{
            width,
            height: interactive ? "auto" : height,
            position: "relative",
            userSelect: "none",
            lineHeight: 0,
          }}
        >
          <button
            type="button"
            className="mascot-character"
            style={{ width, height }}
            aria-label="与看板娘互动"
            disabled={!interactive}
            onClick={onTap}
          >
            <canvas
              id="waifu-canvas"
              ref={canvasRef}
              hidden={engineFailed}
              style={{ width: "100%", height: "100%", background: "transparent" }}
            />
            {engineFailed && (
              <img
                className="mascot-fallback"
                src="/images/asuna-mascot.webp"
                alt=""
                width={width}
                height={height}
              />
            )}
          </button>
          <AnimatePresence>
            {tip && (
              <motion.div
                key={tip}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 28 }}
                className="mascot-message rounded-md border border-border bg-card/95 text-center text-foreground shadow-md backdrop-blur"
              >
                <div className="mascot-message-text">{tip}</div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="mascot-toolbar" hidden={!interactive}>
            {tools.map((tool) => (
              <button
                key={tool.id}
                id={`waifu-tool-${tool.id}`}
                type="button"
                title={tool.label}
                onClick={tool.onClick}
              >
                {tool.icon}
                <span>{tool.label}</span>
              </button>
            ))}
          </div>
        </motion.div>
      </section>
    </div>
  );
}
