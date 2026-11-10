import {
  AmbientLight,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardNodeMaterial,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  TorusGeometry,
  WebGPURenderer,
} from "three/webgpu";
import type { SceneLayer } from "./aincrad-scene";

/** 程序化浮空城，不下载模型或纹理；画布不接管人物、导航或 GSAP 的包装层。 */
export async function mountCastle(
  host: HTMLElement,
  signal: AbortSignal,
  onBackend: (backend: "webgpu" | "webgl" | "static") => void,
  forceWebGL = false,
): Promise<SceneLayer | null> {
  const canvas = document.createElement("canvas");
  const availableAdapter = forceWebGL
    ? null
    : await navigator.gpu?.requestAdapter({ powerPreference: "low-power" }).catch(() => null);
  // 软件 adapter 不走 WebGPU：无硬件收益，且无头 SwiftShader 存在原生错误域异常。
  const adapter = availableAdapter?.info?.isFallbackAdapter ? null : availableAdapter;
  if (signal.aborted) return null;
  // 把同一 adapter 创建的设备直接交给 Three，不再重复请求 adapter。
  const device = await adapter
    ?.requestDevice({
      requiredFeatures: adapter.features.has("core-features-and-limits")
        ? ["core-features-and-limits"]
        : [],
    })
    .catch(() => undefined);
  if (signal.aborted) {
    device?.destroy();
    return null;
  }
  const context = device
    ? undefined
    : canvas.getContext("webgl2", { alpha: true, antialias: true, powerPreference: "low-power" });
  if (!device && !context) return null;
  const renderer = new WebGPURenderer({
    canvas,
    ...(device ? { device } : {}),
    ...(context ? { context } : {}),
    forceWebGL: !device,
    alpha: true,
    antialias: true,
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 768 ? 1.25 : 1.5));
  renderer.setClearColor(0x000000, 0);
  const scene = new Scene();
  const castle = new Group();
  scene.add(castle, new AmbientLight(0xffffff, 2.2));
  const sun = new DirectionalLight(0xffffff, 3.5);
  sun.position.set(-4, 7, 5);
  scene.add(sun);
  const camera = new OrthographicCamera(-4, 4, 4, -4, 0.1, 50);
  camera.position.set(7, 4.5, 11);
  camera.lookAt(0, 0.25, 0);

  const stone = new MeshStandardNodeMaterial({ roughness: 0.8, metalness: 0.12 });
  const gold = new MeshStandardNodeMaterial({ roughness: 0.5, metalness: 0.45 });
  const crimson = new MeshStandardNodeMaterial({ roughness: 0.7 });
  const geometries = new Set<CylinderGeometry | ConeGeometry | TorusGeometry>();
  const mesh = (
    geometry: CylinderGeometry | ConeGeometry | TorusGeometry,
    material: MeshStandardNodeMaterial,
    x: number,
    y: number,
    z = 0,
  ) => {
    geometries.add(geometry);
    const object = new Mesh(geometry, material);
    object.position.set(x, y, z);
    castle.add(object);
    return object;
  };
  for (let floor = 0; floor < 7; floor++) {
    const radius = 0.46 + floor * 0.31;
    const y = -1.65 + floor * 0.43;
    mesh(new CylinderGeometry(radius + 0.11, radius - 0.05, 0.25, 48), stone, 0, y);
    const rim = mesh(new TorusGeometry(radius + 0.09, 0.018, 4, 64), gold, 0, y + 0.13);
    rim.rotation.x = Math.PI / 2;
  }
  mesh(new ConeGeometry(0.33, 0.65, 6), gold, 0, -2.08).rotation.x = Math.PI;
  mesh(new CylinderGeometry(2.57, 2.45, 0.18, 64), stone, 0, 1.24);
  const topRim = mesh(new TorusGeometry(2.55, 0.024, 4, 64), gold, 0, 1.34);
  topRim.rotation.x = Math.PI / 2;
  // 共享塔身与屋顶几何，保持物件数量与 GPU 内存有界。
  const tower = new CylinderGeometry(0.12, 0.16, 0.5, 8);
  const roof = new ConeGeometry(0.18, 0.28, 8);
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const x = Math.cos(angle) * 1.85;
    const z = Math.sin(angle) * 1.85;
    mesh(tower, stone, x, 1.57, z);
    mesh(roof, i % 3 === 0 ? crimson : gold, x, 1.96, z);
  }
  mesh(new CylinderGeometry(0.29, 0.4, 1.25, 8), stone, 0, 1.95);
  mesh(new ConeGeometry(0.43, 0.85, 8), crimson, 0, 3);
  const orbit = mesh(new TorusGeometry(3.15, 0.008, 4, 96), gold, 0, -0.1);
  orbit.rotation.set(Math.PI / 2 + 0.13, 0, -0.1);

  let disposed = false;
  let frame = 0;
  let last = 0;
  let elapsed = 0;
  let pointerX = 0;
  let pointerY = 0;
  let running = false;
  let prepared = false;
  const hero = host.closest<HTMLElement>("[data-home-hero]")!;
  const dark = matchMedia("(prefers-color-scheme: dark)");
  const theme = () => {
    const style = getComputedStyle(host);
    stone.color.set(style.getPropertyValue("--muted").trim());
    gold.color.set(style.getPropertyValue("--sao-gold").trim());
    crimson.color.set(style.getPropertyValue("--primary").trim());
    sun.intensity = dark.matches ? 1.8 : 3.5;
    if (prepared && !running && !disposed) renderer.render(scene, camera);
  };
  const resize = () => {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    const aspect = width / height;
    camera.left = -4.1 * aspect;
    camera.right = 4.1 * aspect;
    camera.top = 4.1;
    camera.bottom = -4.1;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    if (prepared && !running && !disposed) renderer.render(scene, camera);
  };
  const point = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || !running) return;
    const bounds = hero.getBoundingClientRect();
    pointerX = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    pointerY = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
  };
  const resetPointer = () => {
    pointerX = 0;
    pointerY = 0;
  };
  const observer = new ResizeObserver(resize);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    running = false;
    cancelAnimationFrame(frame);
    observer.disconnect();
    dark.removeEventListener("change", theme);
    hero.removeEventListener("pointermove", point);
    hero.removeEventListener("pointerleave", resetPointer);
    canvas.removeEventListener("webglcontextlost", lost);
    signal.removeEventListener("abort", dispose);
    for (const geometry of geometries) geometry.dispose();
    for (const material of [stone, gold, crimson]) material.dispose();
    // Three 不负责销毁外部传入的 device，因此在渲染器释放完成后显式销毁。
    void renderer
      .dispose()
      .catch(() => {})
      .finally(() => device?.destroy());
    canvas.remove();
  };
  const fail = () => {
    onBackend("static");
    dispose();
  };
  const lost = (event: Event) => {
    event.preventDefault();
    fail();
  };
  const draw = (now: number) => {
    if (!running || disposed) return;
    frame = requestAnimationFrame(draw);
    if (now - last < 1000 / 30) return;
    elapsed += Math.min(now - last, 50) / 1000;
    last = now;
    castle.rotation.y += (-0.3 + pointerX * 0.14 - castle.rotation.y) * 0.05;
    castle.rotation.x += (pointerY * 0.045 - castle.rotation.x) * 0.05;
    castle.position.y = Math.sin(elapsed * 0.45) * 0.055;
    try {
      renderer.render(scene, camera);
    } catch {
      fail();
    }
  };
  const layer: SceneLayer = {
    setRunning(value) {
      if (disposed || value === running) return;
      running = value;
      cancelAnimationFrame(frame);
      if (running) {
        last = performance.now();
        frame = requestAnimationFrame(draw);
      }
    },
    dispose,
  };
  signal.addEventListener("abort", dispose, { once: true });
  try {
    await renderer.init();
    if (signal.aborted) {
      dispose();
      return null;
    }
    resize();
    theme();
    await renderer.compileAsync(scene, camera);
    if (signal.aborted) {
      dispose();
      return null;
    }
    prepared = true;
    renderer.render(scene, camera);
    renderer.onDeviceLost = fail;
    canvas.dataset.renderer = "isWebGPUBackend" in renderer.backend ? "webgpu" : "webgl";
    canvas.addEventListener("webglcontextlost", lost);
    hero.addEventListener("pointermove", point, { passive: true });
    hero.addEventListener("pointerleave", resetPointer);
    dark.addEventListener("change", theme);
    observer.observe(host);
    host.append(canvas);
    onBackend(canvas.dataset.renderer as "webgpu" | "webgl");
    return layer;
  } catch {
    dispose();
    // adapter 存在不等于设备和管线一定可用，初始化失败后再尝试 WebGL。
    if (device && !signal.aborted) return mountCastle(host, signal, onBackend, true);
    return null;
  }
}
