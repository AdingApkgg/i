import { expect, test } from "./fixtures";

// 捕获绘制层未挂载、暂停后仍耗帧、减少动态效果仍下载引擎、降级挡住正文和路由泄漏。
test("首屏绘制浮空城与光尘，暂停后画布停止更新，继续后恢复", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const scene = page.locator("[data-aincrad-scene]");
  await expect(scene.locator("[data-castle-layer] canvas")).toBeVisible({ timeout: 30_000 });
  await expect(scene.locator("[data-dust-layer] canvas")).toBeVisible();
  await expect(scene).toHaveAttribute("data-renderer", /^(webgpu|webgl)$/);
  const dust = scene.locator("[data-dust-layer] canvas");
  const frame = () => dust.evaluate((canvas) => canvas.dataset.frame);
  await expect.poll(frame).not.toBe("0");
  await page.getByRole("button", { name: "暂停场景动态", exact: true }).click();
  const stopped = await frame();
  await page.waitForTimeout(250);
  expect(await frame()).toBe(stopped);
  await page.getByRole("button", { name: "继续场景动态", exact: true }).click();
  await expect.poll(frame).not.toBe(stopped);
});

test("减少动态效果不加载绘制引擎，运行中切换会释放画布", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const engines: string[] = [];
  page.on("request", (request) => {
    if (/\/(aincrad-renderer|aincrad-dust|three[._-]|p5[._-])[^/]*\.js/.test(request.url())) {
      engines.push(request.url());
    }
  });
  await page.goto("/");
  const scene = page.locator("[data-aincrad-scene]");
  await expect(scene).toHaveAttribute("data-scene-state", "static");
  await expect(scene.locator("canvas")).toHaveCount(0);
  expect(engines).toEqual([]);
  await expect(page.getByRole("button", { name: "暂停场景动态" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "探索我的世界", exact: true })).toBeVisible();
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(scene.locator("[data-castle-layer] canvas")).toBeVisible({ timeout: 30_000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(scene.locator("canvas")).toHaveCount(0);
});

test("关闭 GPU 能力仍有光尘与静态远景，正文和入口可用", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "gpu", { value: undefined });
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args) {
      if (String(args[0]).startsWith("webgl")) return null;
      return Reflect.apply(getContext, this, args);
    } as typeof getContext;
  });
  await page.goto("/");
  const scene = page.locator("[data-aincrad-scene]");
  await expect(scene).toHaveAttribute("data-renderer", "static", { timeout: 30_000 });
  await expect(scene.locator("[data-dust-layer] canvas")).toBeVisible();
  await expect(scene.locator("[data-castle-fallback]")).toBeVisible();
  await page.getByRole("link", { name: "探索我的世界", exact: true }).click();
  await expect(page.getByRole("navigation", { name: "兴趣地图" })).toBeInViewport();
});

test("WebGPU adapter 存在但设备不可用时直接回退 WebGL", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "gpu", {
      value: {
        requestAdapter: async () => ({
          features: new Set(),
          requestDevice: async () => {
            throw new DOMException("Device unavailable", "NotSupportedError");
          },
        }),
      },
    }),
  );
  await page.goto("/");
  const scene = page.locator("[data-aincrad-scene]");
  await expect(scene.locator("[data-castle-layer] canvas")).toBeVisible({ timeout: 30_000 });
  await expect(scene).toHaveAttribute("data-renderer", "webgl");
});

test("软件 WebGPU adapter 不创建设备，直接选择 WebGL", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "gpu", {
      value: {
        requestAdapter: async () => ({
          info: { isFallbackAdapter: true },
          features: new Set(),
          requestDevice: async () => {
            document.documentElement.dataset.softwareDeviceRequested = "yes";
            throw new DOMException("Software device must not be requested", "NotSupportedError");
          },
        }),
      },
    }),
  );
  await page.goto("/");
  const scene = page.locator("[data-aincrad-scene]");
  await expect(scene.locator("[data-castle-layer] canvas")).toBeVisible({ timeout: 30_000 });
  await expect(scene).toHaveAttribute("data-renderer", "webgl");
  expect(
    await page.evaluate(() => document.documentElement.dataset.softwareDeviceRequested),
  ).toBeUndefined();
});

test("首屏离开视口停绘，返回与客户端换页不会重复创建画布", async ({ page }) => {
  await page.goto("/");
  const scene = page.locator("[data-aincrad-scene]");
  await expect(scene.locator("[data-dust-layer] canvas")).toBeVisible({ timeout: 30_000 });
  await page.locator("#journal").scrollIntoViewIfNeeded();
  await expect(scene).toHaveAttribute("data-scene-state", "sleeping");
  const dust = scene.locator("[data-dust-layer] canvas");
  const frame = await dust.getAttribute("data-frame");
  await page.waitForTimeout(250);
  expect(await dust.getAttribute("data-frame")).toBe(frame);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(scene).toHaveAttribute("data-scene-state", "running");
  await expect.poll(() => dust.getAttribute("data-frame")).not.toBe(frame);
  for (let i = 0; i < 2; i++) {
    await page.getByRole("link", { name: "探索我的世界", exact: true }).click();
    await page.getByRole("link", { name: "前往音乐", exact: true }).click();
    await expect(page.locator("[data-aincrad-scene]")).toHaveCount(0);
    await page.locator("header").getByRole("link", { name: "首页", exact: true }).click();
    await expect(page.locator("[data-castle-layer] canvas")).toHaveCount(1, { timeout: 30_000 });
    await expect(page.locator("[data-dust-layer] canvas")).toHaveCount(1);
  }
});

test("省流量模式保留远景但不下载绘制引擎", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "connection", {
      value: Object.assign(new EventTarget(), { saveData: true }),
    }),
  );
  const engines: string[] = [];
  page.on("request", (request) => {
    if (/\/aincrad-(renderer|dust)[^/]*\.js/.test(request.url())) engines.push(request.url());
  });
  await page.goto("/");
  const scene = page.locator("[data-aincrad-scene]");
  await expect(scene.locator("[data-castle-fallback]")).toBeVisible();
  await expect(scene.locator("canvas")).toHaveCount(0);
  expect(engines).toEqual([]);
});

for (const blocked of ["renderer", "dust"] as const) {
  test(`绘制引擎 ${blocked} 下载失败不影响另一层和正文`, async ({ page }) => {
    await page.route(`**/assets/aincrad-${blocked}-*.js`, (route) => route.abort());
    await page.goto("/");
    const scene = page.locator("[data-aincrad-scene]");
    const remaining = blocked === "renderer" ? "dust" : "castle";
    await expect(scene.locator(`[data-${remaining}-layer] canvas`)).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      scene.locator(`[data-${blocked === "renderer" ? "castle" : "dust"}-layer] canvas`),
    ).toHaveCount(0);
    if (blocked === "renderer") await expect(scene.locator("[data-castle-fallback]")).toBeVisible();
    await page.getByRole("link", { name: "探索我的世界", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "兴趣地图" })).toBeInViewport();
  });
}

test("WebGL 上下文丢失事件后释放 GPU 画布，光尘与静态远景仍可用", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "gpu", { value: undefined }));
  await page.goto("/");
  const scene = page.locator("[data-aincrad-scene]");
  const canvas = scene.locator("[data-castle-layer] canvas");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect(scene).toHaveAttribute("data-renderer", "webgl");
  await canvas.evaluate((element) =>
    element.dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
  );
  await expect(canvas).toHaveCount(0);
  await expect(scene).toHaveAttribute("data-renderer", "static");
  await expect(scene.locator("[data-castle-fallback]")).toBeVisible();
  await expect(scene.locator("[data-dust-layer] canvas")).toBeVisible();
});

for (const width of [320, 390, 1440]) {
  test(`动态首屏在 ${width}px 不遮挡文字、暂停开关或导航`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator("[data-dust-layer] canvas")).toBeVisible({ timeout: 30_000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const pause = page.getByRole("button", { name: "暂停场景动态", exact: true });
    await pause.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "继续场景动态", exact: true })).toBeFocused();
    await page.getByRole("link", { name: "探索我的世界", exact: true }).click();
    await expect(page.getByRole("navigation", { name: "兴趣地图" })).toBeInViewport();
  });
}
