import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// 旧城体／光尘的生命周期覆盖迁到 CSS3D；独立资源故障与 GPU 丢失覆盖真实 Live2D。
// 这组回归在 WEBGPU_GATE=off 的预览上运行，不替代闸门自身的测试。
const stage = (page: Page) => page.locator(".reading-stage");
const field = (page: Page) => page.locator(".scene-field");
const motion = (page: Page) => field(page).locator(".scene-field-motion");
const transform = (page: Page) =>
  motion(page).evaluate((element) => getComputedStyle(element).transform);

const expectMoving = async (page: Page) => {
  await expect(stage(page)).toHaveAttribute("data-scene-running", "true");
  const before = await transform(page);
  await expect.poll(() => transform(page)).not.toBe(before);
};

const expectStopped = async (page: Page) => {
  await expect(stage(page)).toHaveAttribute("data-scene-running", "false");
  await expect
    .poll(() =>
      field(page).evaluate(
        (element) =>
          element.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length,
      ),
    )
    .toBe(0);
  const stopped = await transform(page);
  // 取相隔多个绘制帧的实际变换，不只相信组件的 running 标记。
  await page.waitForTimeout(200);
  expect(await transform(page)).toBe(stopped);
};

const enterPerformance = async (page: Page) => {
  await page.getByRole("button", { name: "演出模式", exact: true }).click();
  await expect(stage(page)).toHaveAttribute("data-scene-mode", "performance");
  await expectMoving(page);
};

const openArticle = async (page: Page) => {
  await expect(page.getByRole("heading", { name: "Asuna", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "读文章", exact: true }).click();
  await expect(page).toHaveURL(/\/#journal$/);
  const article = page.locator("#journal article").first();
  await expect(article).toBeInViewport();
  await article.getByRole("link").click();
  await expect(page).toHaveURL(/\/blog\/[^/]+$/);
};

const returnHome = async (page: Page) => {
  await page
    .getByRole("navigation", { name: "桌面主导航", exact: true })
    .getByRole("link", { name: "首页", exact: true })
    .click();
  await expect(page).toHaveURL("/");
};

const legacyEngineRequests = (page: Page) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (/\/(aincrad-(renderer|dust)|three[._-]|p5[._-])[^/]*\.js/.test(request.url())) {
      requests.push(request.url());
    }
  });
  return requests;
};

test("CSS3D 演出真正运行，暂停冻结变换，继续恢复", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(field(page)).toBeVisible();
  await expect(field(page).locator(".scene-plane")).toHaveCount(3);
  await expect(stage(page)).toHaveAttribute("data-scene-mode", "reading");
  await expectStopped(page);
  await enterPerformance(page);
  await page.getByRole("button", { name: "暂停动态", exact: true }).click();
  await expectStopped(page);
  await page.getByRole("button", { name: "继续动态", exact: true }).click();
  await expectMoving(page);
  await openArticle(page);
});

test("减少动态初始静态，运行期切换也立即停动且不下载旧引擎", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const engines = legacyEngineRequests(page);
  await page.goto("/");
  await page.getByRole("button", { name: "演出模式", exact: true }).click();
  await expect(stage(page)).toHaveAttribute("data-scene-static", "true");
  await expectStopped(page);
  await expect(page.getByRole("button", { name: "暂停动态", exact: true })).toBeDisabled();
  await expect(field(page).locator("canvas")).toHaveCount(0);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expectMoving(page);
  await page.mouse.move(700, 300);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expectStopped(page);
  await expect(motion(page)).toHaveCSS("animation-name", "none");
  await expect(field(page).locator(".scene-camera")).toHaveCSS("transform", "none");
  await expect(field(page).locator(".scene-plane-far")).toHaveCSS("transition-duration", "0s");
  await openArticle(page);
  expect(engines).toEqual([]);
});

test("gate-off 且无 GPU 时 CSS3D 仍可演出，正文入口不受影响", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "gpu", { value: undefined });
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args) {
      if (String(args[0]).startsWith("webgl")) return null;
      return Reflect.apply(getContext, this, args);
    } as typeof getContext;
  });
  await page.goto("/");
  await expect(page.locator(".webgpu-gate")).toHaveCount(0);
  await enterPerformance(page);
  await expect(field(page).locator("canvas")).toHaveCount(0);
  await openArticle(page);
});

for (const adapter of ["unavailable-device", "software"] as const) {
  test(`CSS3D 不探测或误用 ${adapter} WebGPU adapter`, async ({ page }) => {
    await page.addInitScript((kind) => {
      Object.defineProperty(navigator, "gpu", {
        value: {
          requestAdapter: async () => {
            document.documentElement.dataset.adapterRequested = "yes";
            return {
              info: { isFallbackAdapter: kind === "software" },
              features: new Set(),
              requestDevice: async () => {
                document.documentElement.dataset.deviceRequested = "yes";
                throw new DOMException("Device unavailable", "NotSupportedError");
              },
            };
          },
        },
      });
    }, adapter);
    await page.goto("/");
    await enterPerformance(page);
    await openArticle(page);
    expect(
      await page.evaluate(() => ({
        adapter: document.documentElement.dataset.adapterRequested,
        device: document.documentElement.dataset.deviceRequested,
      })),
    ).toEqual({ adapter: undefined, device: undefined });
  });
}

test("离屏冻结 CSS3D，回顶恢复；客户端路由往返不重复挂层", async ({ page }) => {
  // 短窗让最小 seed 的正文也足以把首屏完全滚出视口。
  await page.setViewportSize({ width: 1440, height: 360 });
  await page.goto("/");
  await enterPerformance(page);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(field(page)).not.toBeInViewport();
  await expectStopped(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expectMoving(page);
  for (let i = 0; i < 2; i++) {
    await openArticle(page);
    await expect(field(page)).toHaveCount(0);
    await expect(page.locator(".scene-plane")).toHaveCount(0);
    await returnHome(page);
    await expect(field(page)).toHaveCount(1);
    await expect(field(page).locator(".scene-camera")).toHaveCount(1);
    await expect(field(page).locator(".scene-plane")).toHaveCount(3);
    await expectStopped(page);
    await enterPerformance(page);
  }
});

test("省流量保留静态演出构图和正文，不下载旧绘制引擎", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "connection", {
      value: Object.assign(new EventTarget(), { saveData: true }),
    }),
  );
  const engines = legacyEngineRequests(page);
  await page.goto("/");
  await page.getByRole("button", { name: "演出模式", exact: true }).click();
  await expect(field(page)).toBeVisible();
  await expect(field(page).locator(".scene-plane")).toHaveCount(3);
  await expectStopped(page);
  await expect(motion(page)).toHaveCSS("animation-name", "none");
  await expect(field(page).locator(".scene-plane-far")).toHaveCSS("transition-duration", "0s");
  await expect(page.getByRole("button", { name: "暂停动态", exact: true })).toBeDisabled();
  await openArticle(page);
  expect(engines).toEqual([]);
});

// 与 live2d.spec.ts 一样，必须由真实拍照入口导出同帧 PNG，再检测非透明像素。
const expectPaintedPhoto = async (page: Page) => {
  const trigger = page.getByRole("button", { name: "看板娘工具与互动", exact: true });
  if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
  await expect(page.getByRole("dialog", { name: "看板娘工具与互动", exact: true })).toBeVisible();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#waifu-tool-photo").click(),
  ]);
  const file = await download.path();
  expect(file).not.toBeNull();
  const png = await readFile(file!);
  const coverage = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
    const image = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
    const frame = new OffscreenCanvas(image.width, image.height);
    const context = frame.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, image.width, image.height).data;
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) opaque++;
    image.close();
    return opaque / (data.length / 4);
  }, png.toString("base64"));
  expect(coverage).toBeGreaterThan(0.03);
};

test.describe("独立 Live2D 装饰资源和 WebGL 生命周期", () => {
  test.use({ showMascot: true, screen: { width: 1440, height: 1000 } });
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        "i.mascot",
        JSON.stringify({ state: { hidden: false, group: 0, costume: 0 }, version: 0 }),
      ),
    );
  });

  for (const resource of [
    { name: "core", path: "/live2d/core/live2d.min.js", error: "live2d core load failed" },
    {
      name: "model",
      path: "/live2d/model/asuna/asuna_02/moc/asuna_02.moc",
      error: "/live2d/model/asuna/asuna_02/moc/asuna_02.moc: 503",
    },
  ]) {
    test(`${resource.name} 实际下载失败不阻断 CSS3D 或正文，重新召唤可恢复绘制`, async ({
      page,
      consoleProblems,
    }) => {
      let blocked = 0;
      const url = `**${resource.path}`;
      await page.route(url, (route) => {
        blocked++;
        return route.fulfill({ status: 503, body: "decorative resource unavailable" });
      });
      await page.goto("/");
      // 只认领这一次注入故障的精确应用告警，其余告警仍由 fixture 严格报错。
      const expected = `[warning] /: [waifu] model load failed: Error: ${resource.error}`;
      const isExpected = (problem: string) => problem.split("\n")[0] === expected;
      await expect.poll(() => consoleProblems.filter(isExpected).length).toBe(1);
      expect(blocked).toBe(1);
      consoleProblems.splice(consoleProblems.findIndex(isExpected), 1);
      await enterPerformance(page);
      await openArticle(page);
      await returnHome(page);
      await page.unroute(url);
      await page.getByRole("button", { name: "看板娘工具与互动", exact: true }).click();
      await page.locator("#waifu-tool-quit").click();
      await expect(page.locator("#waifu-canvas")).toHaveCount(0);
      await page.getByTitle("召唤看板娘", { exact: true }).click();
      await expectPaintedPhoto(page);
      expect(blocked).toBe(1);
    });
  }

  test("看板娘 WebGL 上下文丢失后停绘，CSS3D 与正文继续可用，重召唤恢复", async ({ page }) => {
    // 透传原生绘制，只计真实 draw；即使丢失后 GL 变成 no-op，也能抓到泄漏的循环。
    await page.addInitScript(() => {
      const draw = WebGLRenderingContext.prototype.drawElements;
      WebGLRenderingContext.prototype.drawElements = function (...args) {
        if (this.canvas instanceof HTMLCanvasElement && this.canvas.id === "waifu-canvas") {
          this.canvas.dataset.draws = String(Number(this.canvas.dataset.draws ?? 0) + 1);
        }
        return Reflect.apply(draw, this, args);
      };
    });
    await page.goto("/");
    await enterPerformance(page);
    await expectPaintedPhoto(page);
    await page.getByRole("button", { name: "关闭互动面板", exact: true }).click();
    const canvas = page.locator("#waifu-canvas");
    const draws = () => canvas.getAttribute("data-draws");
    await expect.poll(async () => Number(await draws())).toBeGreaterThan(0);
    const prevented = await canvas.evaluate(async (element: HTMLCanvasElement) => {
      const gl = element.getContext("webgl")!;
      const extension = gl.getExtension("WEBGL_lose_context");
      if (!extension) throw new Error("WEBGL_lose_context unavailable");
      return new Promise<boolean>((resolve) => {
        element.addEventListener("webglcontextlost", (event) => resolve(event.defaultPrevented), {
          once: true,
        });
        extension.loseContext();
      });
    });
    expect(prevented).toBe(true);
    const stopped = await draws();
    await page.waitForTimeout(250);
    expect(await draws()).toBe(stopped);
    await expectMoving(page);
    await openArticle(page);
    await returnHome(page);
    await page.getByRole("button", { name: "看板娘工具与互动", exact: true }).click();
    await page.locator("#waifu-tool-quit").click();
    await expect(canvas).toHaveCount(0);
    await page.getByTitle("召唤看板娘", { exact: true }).click();
    await expectPaintedPhoto(page);
    await expect(canvas).toHaveCount(1);
    await expect(field(page).locator(".scene-plane")).toHaveCount(3);
  });
});

for (const width of [320, 390, 1440]) {
  test(`CSS3D 演出在 ${width}px 不横溢，暂停和正文入口可键盘操作`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await enterPerformance(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const pause = page.getByRole("button", { name: "暂停动态", exact: true });
    await pause.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "继续动态", exact: true })).toBeFocused();
    await expectStopped(page);
    await page.keyboard.press("Enter");
    await expectMoving(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "演出模式", exact: true })).toBeFocused();
    await expectStopped(page);
    const read = page.getByRole("link", { name: "读文章", exact: true });
    await read.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/#journal$/);
    const link = page.locator("#journal article").first().getByRole("link");
    await link.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/blog\/[^/]+$/);
  });
}
