import P5 from "p5";
import type { SceneLayer } from "./aincrad-scene";

/** p5 仅使用 Canvas 2D；不创建第二个 GPU 上下文，不把实例方法挂到 window。 */
export function mountDust(host: HTMLElement, signal: AbortSignal): Promise<SceneLayer | null> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve(null);
    let disposed = false;
    let running = false;
    let canvas: HTMLCanvasElement | null = null;
    let time = 0;
    let pointer: { x: number; y: number; age: number } | null = null;
    let color: [number, number, number] = [182, 154, 99];
    const hero = host.closest<HTMLElement>("[data-home-hero]")!;
    const dark = matchMedia("(prefers-color-scheme: dark)");
    const theme = () => {
      // 当前主题 token 为 hex，由浏览器解析成 RGB 分量。
      const probe = document.createElement("span");
      probe.style.color = "var(--sao-gold)";
      host.append(probe);
      const values = getComputedStyle(probe)
        .color.match(/[\d.]+/g)
        ?.map(Number);
      if (values && values.length >= 3) color = [values[0]!, values[1]!, values[2]!];
      probe.remove();
    };
    theme();
    const point = (event: PointerEvent) => {
      if (!running || event.pointerType !== "mouse") return;
      const bounds = host.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      if (x < bounds.width * 0.45) return;
      pointer = { x, y: event.clientY - bounds.top, age: 1 };
    };
    const observer = new ResizeObserver(() => {
      if (!disposed && canvas) sketch.resizeCanvas(host.clientWidth, host.clientHeight);
    });
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      running = false;
      observer.disconnect();
      dark.removeEventListener("change", theme);
      hero.removeEventListener("pointermove", point);
      signal.removeEventListener("abort", dispose);
      void sketch.remove();
      resolve(null);
    };
    const sketch = new P5((p) => {
      p.setup = () => {
        if (signal.aborted) {
          dispose();
          return;
        }
        const output = p.createCanvas(
          Math.max(1, host.clientWidth),
          Math.max(1, host.clientHeight),
        );
        canvas = output.elt as HTMLCanvasElement;
        canvas.dataset.frame = "0";
        canvas.setAttribute("aria-hidden", "true");
        p.pixelDensity(Math.min(devicePixelRatio, 1.5));
        p.frameRate(30);
        p.noLoop();
        observer.observe(host);
        dark.addEventListener("change", theme);
        hero.addEventListener("pointermove", point, { passive: true });
        resolve({
          setRunning(value) {
            if (disposed || running === value) return;
            running = value;
            if (running) p.loop();
            else p.noLoop();
          },
          dispose,
        });
      };
      p.draw = () => {
        if (disposed || !canvas) return;
        p.clear();
        time += Math.min(p.deltaTime, 50) / 1000;
        canvas.dataset.frame = String(p.frameCount);
        const count = p.width < 768 ? 22 : 40;
        p.noStroke();
        for (let i = 0; i < count; i++) {
          const phase = i * 2.39996;
          const x = p.width * (0.42 + ((i * 0.137 + time * 0.004) % 0.56));
          const y = p.height * (0.12 + ((((i * 0.213 - time * 0.008) % 0.76) + 0.76) % 0.76));
          const alpha = 50 + Math.sin(time * 0.7 + phase) * 35;
          const size = i % 5 === 0 ? 3 : 1.5;
          p.fill(color[0], color[1], color[2], alpha);
          p.push();
          p.translate(x + Math.sin(time * 0.3 + phase) * 9, y);
          p.rotate(Math.PI / 4);
          p.rect(-size / 2, -size / 2, size, size);
          p.pop();
        }
        // 鼠标经过右侧远景才显现短暂细剑光线；不追随触屏手势。
        if (pointer && pointer.age > 0) {
          pointer.age -= 0.025;
          p.stroke(color[0], color[1], color[2], Math.max(0, pointer.age) * 90);
          p.strokeWeight(0.7);
          p.line(pointer.x - 24, pointer.y + 10, pointer.x + 24, pointer.y - 10);
          p.noStroke();
        }
      };
    }, host);
    signal.addEventListener("abort", dispose, { once: true });
  });
}
