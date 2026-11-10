import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type SceneLayer = { setRunning: (running: boolean) => void; dispose: () => void };

/** SVG 始终由 SSR 输出；绘制引擎只在客户端且未要求静态画面时加载。 */
export function AincradScene() {
  const root = useRef<HTMLDivElement>(null);
  const castle = useRef<HTMLDivElement>(null);
  const dust = useRef<HTMLDivElement>(null);
  const layers = useRef<SceneLayer[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [ready, setReady] = useState(false);
  const [renderer, setRenderer] = useState("static");
  const running = enabled && !paused && visible && !hidden;
  const runningRef = useRef(running);
  runningRef.current = running;

  useEffect(() => {
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const connection = (
      navigator as Navigator & {
        connection?: EventTarget & { saveData?: boolean };
      }
    ).connection;
    const update = () => setEnabled(!motion.matches && !connection?.saveData);
    update();
    motion.addEventListener("change", update);
    // 省流量提示不一定是完整 Connection 实现（例如被测试桩成普通对象），事件监听按可选处理。
    connection?.addEventListener?.("change", update);
    return () => {
      motion.removeEventListener("change", update);
      connection?.removeEventListener?.("change", update);
    };
  }, []);

  useEffect(() => {
    const update = () => setHidden(document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting ?? false),
      {
        threshold: 0,
      },
    );
    if (root.current) observer.observe(root.current);
    return () => {
      document.removeEventListener("visibilitychange", update);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!enabled || !castle.current || !dust.current) return;
    const abort = new AbortController();
    const accept = (layer: SceneLayer | null) => {
      if (!layer) return;
      if (abort.signal.aborted) return layer.dispose();
      layers.current.push(layer);
      layer.setRunning(runningRef.current);
      setReady(true);
    };
    // 两层独立加载和降级，任意一层失败不妨碍另一层或正文。
    void import("./aincrad-renderer")
      .then(({ mountCastle }) =>
        abort.signal.aborted
          ? null
          : mountCastle(castle.current!, abort.signal, (backend) => {
              if (!abort.signal.aborted) setRenderer(backend);
            }),
      )
      .then(accept)
      .catch(() => {
        if (!abort.signal.aborted) setRenderer("static");
      });
    void import("./aincrad-dust")
      .then(({ mountDust }) =>
        abort.signal.aborted ? null : mountDust(dust.current!, abort.signal),
      )
      .then(accept)
      .catch(() => {}); // 装饰加载失败时保留 SSR 远景，不让错误进入页面边界。
    return () => {
      abort.abort();
      for (const layer of layers.current) layer.dispose();
      layers.current = [];
      setReady(false);
      setRenderer("static");
    };
  }, [enabled]);

  useEffect(() => {
    for (const layer of layers.current) layer.setRunning(running);
  }, [running]);

  const state = !enabled ? "static" : paused ? "paused" : running ? "running" : "sleeping";
  return (
    <>
      <div
        ref={root}
        className="aincrad-scene"
        data-aincrad-scene
        data-scene-state={state}
        data-renderer={renderer}
        aria-hidden="true"
      >
        <div className="aincrad-horizon" />
        <svg
          aria-hidden="true"
          data-castle-fallback
          className="aincrad-fallback"
          viewBox="0 0 640 640"
          fill="none"
        >
          <g className="aincrad-orbit">
            <ellipse cx="320" cy="350" rx="267" ry="62" transform="rotate(-16 320 350)" />
            <path d="M47 319h32m482 0h32M320 52v24m0 484v24" />
            <circle cx="92" cy="403" r="4" />
            <circle cx="548" cy="276" r="3" />
          </g>
          <g className="aincrad-silhouette">
            <path d="M309 181v-46l11-39 11 39v46m-43 2v-29l-8-18-8 18v34m80 0v-34l8-18 8 18v29M205 209v-32l9-17 9 17v26m194 6v-32l9-17 9 17v33" />
            <path d="M166 235q154-74 308 0l-17 37q-137 62-274 0zM185 285q135 61 270 0l-19 36q-116 51-232 0zM207 333q113 49 226 0l-22 34q-91 40-182 0zM233 379q87 36 174 0l-25 32q-62 26-124 0zM263 422q57 22 114 0l-28 32q-29 13-58 0zM296 465l24 44 24-44" />
            <ellipse cx="320" cy="234" rx="154" ry="38" />
            <path d="M199 237q121-52 242 0M230 228v-28m38 20v-27m104 27v-27m38 35v-28" />
          </g>
        </svg>
        <div ref={castle} data-castle-layer className="aincrad-castle" />
        <div ref={dust} data-dust-layer className="aincrad-dust" />
      </div>
      {enabled && ready && (
        <button
          type="button"
          className="aincrad-motion-toggle"
          aria-label={paused ? "继续场景动态" : "暂停场景动态"}
          aria-pressed={paused}
          onClick={() => setPaused((value) => !value)}
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
          <span>{paused ? "继续动态" : "暂停动态"}</span>
        </button>
      )}
    </>
  );
}
