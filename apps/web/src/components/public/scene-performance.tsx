import { useCallback, useEffect, useRef, useState } from "react";

type Mode = "reading" | "performance";

const supportsDepth = () =>
  CSS.supports("transform-style", "preserve-3d") && CSS.supports("perspective", "1000px");

type EventMap = WindowEventMap & DocumentEventMap & GlobalEventHandlersEventMap;

const prefersSaveData = () =>
  Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

/**
 * 首页演出模式：阅读态是静态的默认构图，演出态只由用户开启。
 * 抽象场景只有三层界面面片和一个共同视点，不绘制未经核验的城体实景；
 * 动画在减少动态、省流量、不支持 3D、离屏或页面隐藏时都停住。
 */
export function ScenePerformance() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const runningRef = useRef(false);
  const [enhanced, setEnhanced] = useState(false);
  const [mode, setMode] = useState<Mode>("reading");
  const [paused, setPaused] = useState(false);
  const [staticOnly, setStaticOnly] = useState(false);
  const [visible, setVisible] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);

  const running = mode === "performance" && !paused && !staticOnly && visible && pageVisible;
  runningRef.current = running;

  const backToReading = useCallback(() => {
    setMode("reading");
    setPaused(false);
    toggleRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const stage = fieldRef.current?.closest<HTMLElement>(".reading-stage");
    if (!stage) return;
    stageRef.current = stage;
    const life = new AbortController();
    const listen = <K extends keyof EventMap>(
      target: EventTarget,
      type: K,
      handler: (event: EventMap[K]) => void,
    ) => target.addEventListener(type, handler as EventListener, { signal: life.signal });

    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const forced = matchMedia("(forced-colors: active)");
    const syncStatic = () =>
      setStaticOnly(reduced.matches || forced.matches || prefersSaveData() || !supportsDepth());
    syncStatic();
    setEnhanced(true);
    for (const query of [reduced, forced]) listen(query, "change", syncStatic);
    const connection = (navigator as Navigator & { connection?: EventTarget }).connection;
    connection?.addEventListener("change", syncStatic, { signal: life.signal });

    const observer = new IntersectionObserver(
      (entries) => setVisible(entries.at(-1)?.isIntersecting ?? true),
      { threshold: 0 },
    );
    // 观察首屏演出区本身：整页 stage 很长，滚到正文后仍会相交，判断不出离屏。
    if (fieldRef.current) observer.observe(fieldRef.current);
    listen(document, "visibilitychange", () =>
      setPageVisible(document.visibilityState === "visible"),
    );
    setPageVisible(document.visibilityState === "visible");
    listen(document, "pointerleave", () => {
      stage.style.setProperty("--camera-x", "0px");
      stage.style.setProperty("--camera-y", "0px");
    });

    let frame = 0;
    let nextX = 0;
    let nextY = 0;
    const applyCamera = () => {
      frame = 0;
      stage.style.setProperty("--camera-x", `${nextX}px`);
      stage.style.setProperty("--camera-y", `${nextY}px`);
    };
    listen(stage, "pointermove", (event) => {
      if (!runningRef.current) return;
      const rect = stage.getBoundingClientRect();
      const x = Math.round(((event.clientX - rect.left) / rect.width - 0.5) * -14);
      const y = Math.round(((event.clientY - rect.top) / rect.height - 0.5) * -10);
      if (x === nextX && y === nextY) return;
      nextX = x;
      nextY = y;
      if (!frame) frame = requestAnimationFrame(applyCamera);
    });

    return () => {
      life.abort();
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      stage.style.removeProperty("--camera-x");
      stage.style.removeProperty("--camera-y");
      delete stage.dataset.sceneMode;
      delete stage.dataset.sceneRunning;
      delete stage.dataset.sceneStatic;
    };
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.dataset.sceneMode = mode;
    stage.dataset.sceneRunning = String(running);
    stage.dataset.sceneStatic = String(staticOnly);
    if (running) return;
    stage.style.setProperty("--camera-x", "0px");
    stage.style.setProperty("--camera-y", "0px");
    if (!staticOnly) return;
    for (const animation of fieldRef.current?.getAnimations({ subtree: true }) ?? []) {
      animation.currentTime = 0;
    }
    for (const animation of stage.getAnimations({ subtree: true })) {
      if (animation instanceof CSSTransition) animation.finish();
    }
  }, [mode, running, staticOnly]);

  useEffect(() => {
    if (mode !== "performance") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector("dialog[open], .mascot-panel[data-interactive='true']")) return;
      event.preventDefault();
      backToReading();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mode, backToReading]);

  const status = !enhanced
    ? ""
    : mode === "reading"
      ? "阅读态 · 动态未开启"
      : reducedSignal(staticOnly) === "reduced"
        ? "演出构图 · 跟随减少动态偏好"
        : staticOnly && prefersSaveData()
          ? "演出构图 · 省流量静态展示"
          : staticOnly
            ? "演出构图 · 静态展示"
            : paused
              ? "演出已暂停 · Esc 返回阅读"
              : !running
                ? "演出已暂歇 · 回到首屏后继续"
                : "演出中 · Esc 返回阅读";

  return (
    <>
      <div className="scene-field" ref={fieldRef} aria-hidden="true">
        <div className="scene-camera">
          <div className="scene-field-motion">
            <div className="scene-plane scene-plane-far" />
            <div className="scene-plane scene-plane-mid" />
            <div className="scene-plane scene-plane-near" />
          </div>
        </div>
      </div>
      {enhanced && (
        <fieldset className="scene-controls" aria-label="首页演出控制">
          <button
            type="button"
            ref={toggleRef}
            aria-pressed={mode === "performance"}
            onClick={() => {
              if (mode === "performance") {
                backToReading();
                return;
              }
              setMode("performance");
              setPaused(false);
            }}
          >
            演出模式
          </button>
          <button
            type="button"
            disabled={mode !== "performance" || staticOnly}
            aria-pressed={paused}
            onClick={() => setPaused((value) => !value)}
          >
            {paused ? "继续动态" : "暂停动态"}
          </button>
          <button type="button" hidden={mode === "reading"} onClick={backToReading}>
            返回阅读
          </button>
          <p className="scene-status" role="status">
            {status}
          </p>
        </fieldset>
      )}
    </>
  );
}

/** 静态原因只用于状态文案，不是独立状态机。 */
function reducedSignal(staticOnly: boolean) {
  if (!staticOnly) return "none";
  return matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "other";
}
