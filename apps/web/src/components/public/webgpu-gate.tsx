import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { checkWebGpu, type GateReason } from "@/lib/webgpu-gate";
import "./webgpu-gate.css";

const DETECTED: Record<GateReason, string> = {
  "no-api": "这个浏览器没有提供 WebGPU 接口。",
  "no-adapter": "浏览器有 WebGPU 接口，但没给出可用的 GPU 适配器。",
  software: "只拿到软件渲染的适配器（SwiftShader 一类），没有硬件加速。",
  error: "检测 WebGPU 时出错，多半是 GPU 进程或驱动不可用。",
};

/**
 * WebGPU 闸门：检测不过就整站只显示这一屏。
 *
 * 不做任何降级或响应式替代——首屏场景与看板娘都依赖 WebGPU，
 * 能跑和不能跑之间没有中间档，所以要求访客换平台或浏览器（2026-11 决定）。
 * 检测通过后在客户端卸载，`html[data-webgpu-gate]` 也只在不通过时挂上。
 */
export function WebGpuGate({ enabled }: { enabled: boolean }) {
  const [verdict, setVerdict] = useState<{ ok: boolean; reason?: GateReason } | null>(null);
  const retryRef = useRef<HTMLButtonElement>(null);

  // 检测本身是可重入的：首屏跑一次，点“重新检测”再跑一次，结果没回来之前保持现状。
  const check = useCallback(() => {
    let live = true;
    void checkWebGpu().then((next) => {
      if (live) setVerdict(next);
    });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    return check();
  }, [enabled, check]);

  const reason = enabled && verdict && !verdict.ok ? verdict.reason : undefined;
  const blocked = reason !== undefined;

  useEffect(() => {
    const root = document.documentElement;
    if (blocked) root.dataset.webgpuGate = "blocked";
    else delete root.dataset.webgpuGate;
    return () => {
      delete root.dataset.webgpuGate;
    };
  }, [blocked]);

  useEffect(() => {
    if (blocked) retryRef.current?.focus({ preventScroll: true });
  }, [blocked]);

  if (!blocked) return null;

  // 挂到 body 下，才能用 CSS 把其余节点一起藏掉（否则闸门自己也跟着消失）。
  return createPortal(
    <div
      className="webgpu-gate"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="webgpu-gate-title"
      aria-describedby="webgpu-gate-lead"
      data-webgpu-gate-reason={reason}
    >
      <section className="webgpu-gate-card">
        <p className="webgpu-gate-eyebrow">SAO · WebGPU</p>
        <h1 className="webgpu-gate-title" id="webgpu-gate-title">
          这台设备暂时进不来
        </h1>
        <p className="webgpu-gate-lead" id="webgpu-gate-lead">
          站内的浮空城首屏和看板娘都由 WebGPU 实时渲染。检测没通过，就先停在这里—— 换一个支持 WebGPU
          的浏览器或设备再打开，不会让你看到半截页面。
        </p>
        <p className="webgpu-gate-detected">检测结果：{DETECTED[reason]}</p>
        <p className="webgpu-gate-section">目前可用</p>
        <ul className="webgpu-gate-list">
          <li>Chrome / Edge 113 及以上（Windows、macOS、ChromeOS）</li>
          <li>Safari 26 及以上（macOS 26、iOS 26、iPadOS 26）</li>
          <li>Firefox 141 及以上（Windows；Apple 芯片的 Mac 需要 147 及以上）</li>
          <li>Android 上的 Chrome 121 及以上（Android 12+，高通或 ARM 显卡）</li>
        </ul>
        <p className="webgpu-gate-section">可以试试</p>
        <ul className="webgpu-gate-list">
          <li>在浏览器设置里打开「使用图形加速 / 硬件加速」，然后重开浏览器</li>
          <li>
            Chrome、Edge 打开 <code>chrome://gpu</code>，看 WebGPU 是否标为 Hardware accelerated
          </li>
          <li>更新显卡驱动；远程桌面、虚拟机和部分无头环境拿不到硬件 GPU</li>
        </ul>
        <div className="webgpu-gate-actions">
          <button className="webgpu-gate-retry" onClick={check} ref={retryRef} type="button">
            重新检测
          </button>
        </div>
        <p className="webgpu-gate-foot">
          不想换浏览器的话，用一台支持 WebGPU 的电脑或手机打开本站也可以。
        </p>
      </section>
    </div>,
    document.body,
  );
}
