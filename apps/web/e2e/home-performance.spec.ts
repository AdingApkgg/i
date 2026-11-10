import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// 演出模式是主动开启的第二态：阅读态先成立，动态只在演出态、可见、非静态偏好下运行。

const field = (page: Page) => page.locator(".scene-field");
const stage = (page: Page) => page.locator(".reading-stage");
const toggle = (page: Page) => page.getByRole("button", { name: "演出模式", exact: true });

const motionOf = (page: Page) =>
  field(page).evaluate((element) => {
    const animations = element.getAnimations({ subtree: true });
    return {
      running: animations.filter((a) => a.playState === "running").length,
      paused: animations.filter((a) => a.playState === "paused").length,
    };
  });

const enterPerformance = async (page: Page) => {
  await toggle(page).click();
  await expect(stage(page)).toHaveAttribute("data-scene-mode", "performance");
  await expect(stage(page)).toHaveAttribute("data-scene-running", "true");
  await expect.poll(async () => (await motionOf(page)).running).toBeGreaterThan(0);
};

test("阅读态没有动态，开启演出后才动；暂停、继续与 Escape 回到阅读", async ({ page }) => {
  await page.goto("/");
  await expect(toggle(page)).toBeVisible();
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  await expect(stage(page)).toHaveAttribute("data-scene-mode", "reading");
  await expect.poll(async () => (await motionOf(page)).running).toBe(0);
  const planes = field(page).locator(".scene-plane");
  await expect(planes).toHaveCount(3);

  await enterPerformance(page);
  // 暂停按钮的可见文字在“暂停动态／继续动态”间切换，定位按列位而不按名字。
  const pause = page.locator(".scene-controls button").nth(1);
  await pause.click();
  await expect(stage(page)).toHaveAttribute("data-scene-running", "false");
  await expect(pause).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await motionOf(page)).paused).toBeGreaterThan(0);
  await expect(page.getByRole("status")).toContainText("演出已暂停");

  await expect(pause).toHaveAccessibleName("继续动态");
  await pause.click();
  await expect(stage(page)).toHaveAttribute("data-scene-running", "true");

  await page.keyboard.press("Escape");
  await expect(stage(page)).toHaveAttribute("data-scene-mode", "reading");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  await expect(toggle(page)).toBeFocused();
  await expect(page.getByRole("button", { name: "返回阅读", exact: true })).toBeHidden();
  await expect.poll(async () => (await motionOf(page)).running).toBe(0);
});

test("离开首屏停动、回顶恢复，且不劫持滚动", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1000 });
  await page.goto("/");
  await enterPerformance(page);
  const journalVisible = await page
    .locator("#journal article")
    .first()
    .evaluate((element) => element.getBoundingClientRect().top < innerHeight);
  expect(journalVisible, "动态不换走首屏文章").toBe(true);
  // 上面的首屏断言保留 900×1000；短 seed 需缩短窗口，才能真的把演出区完全滚出。
  await page.setViewportSize({ width: 900, height: 360 });
  await page.evaluate(() => scrollTo(0, 4000));
  await expect(field(page)).not.toBeInViewport();
  await expect(stage(page)).toHaveAttribute("data-scene-running", "false");
  await expect.poll(async () => (await motionOf(page)).running).toBe(0);
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await page.evaluate(() => scrollTo(0, 0));
  await expect(stage(page)).toHaveAttribute("data-scene-running", "true");
});

test("页面隐藏时停动，返回后继续", async ({ page }) => {
  // 这个 Chromium 的 Page.setWebLifecycleState(frozen) 不改 visibilityState，也不发事件；
  // 这里用 getter 桩驱动真实 visibilitychange 处理路径（CDP 冻结另有一条用例）。
  await page.addInitScript(() => {
    let state: DocumentVisibilityState = "visible";
    Object.defineProperty(document, "visibilityState", { get: () => state, configurable: true });
    (window as unknown as Window & { __set: (next: DocumentVisibilityState) => void }).__set = (
      next,
    ) => {
      state = next;
      document.dispatchEvent(new Event("visibilitychange"));
    };
  });
  await page.goto("/");
  await enterPerformance(page);
  await page.evaluate(() =>
    (window as unknown as Window & { __set: (next: string) => void }).__set("hidden"),
  );
  await expect(stage(page)).toHaveAttribute("data-scene-running", "false");
  await expect.poll(async () => (await motionOf(page)).running).toBe(0);
  await page.evaluate(() =>
    (window as unknown as Window & { __set: (next: string) => void }).__set("visible"),
  );
  await expect(stage(page)).toHaveAttribute("data-scene-running", "true");
});

test("CDP 冻结页面时不误判为暂停", async ({ page }) => {
  await page.goto("/");
  await enterPerformance(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Page.setWebLifecycleState", { state: "frozen" });
  await expect(stage(page)).toHaveAttribute("data-scene-running", "true");
  await expect(page.getByRole("status")).toContainText("演出中");
  await cdp.send("Page.setWebLifecycleState", { state: "active" });
});

test.describe("减少动态直接静态降级", () => {
  test.use({ reducedMotion: "reduce" });
  test("可开启构图但不动，也不留暂停空档", async ({ page }) => {
    await page.goto("/");
    await toggle(page).click();
    await expect(stage(page)).toHaveAttribute("data-scene-static", "true");
    await expect(stage(page)).toHaveAttribute("data-scene-running", "false");
    await expect.poll(async () => (await motionOf(page)).running).toBe(0);
    await expect(page.getByRole("button", { name: "暂停动态", exact: true })).toBeDisabled();
    await expect(page.getByRole("status")).toContainText("减少动态");
  });
});

test("forced-colors 只保留静态构图", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.goto("/");
  await toggle(page).click();
  await expect(stage(page)).toHaveAttribute("data-scene-static", "true");
  await expect(field(page)).toHaveCSS("display", "none");
});

test("省流量与不支持 3D 时静态降级", async ({ page }) => {
  await page.addInitScript(() => {
    const connection = new EventTarget() as EventTarget & { saveData: boolean };
    connection.saveData = true;
    Object.defineProperty(navigator, "connection", { value: connection, configurable: true });
  });
  await page.goto("/");
  await toggle(page).click();
  await expect(stage(page)).toHaveAttribute("data-scene-static", "true");
  await expect(page.getByRole("status")).toContainText("省流量");
  // 静态降级把呼吸动画与面片过渡都关掉，不是只停播。
  await expect(field(page).locator(".scene-field-motion")).toHaveCSS("animation-name", "none");
  await expect(field(page).locator(".scene-plane-far")).toHaveCSS("transition-duration", "0s");
});

test("缺少 preserve-3d 时静态降级", async ({ page }) => {
  await page.addInitScript(() => {
    const original = CSS.supports.bind(CSS);
    CSS.supports = ((property: string, value?: string) =>
      property === "transform-style"
        ? false
        : original(property, value as string)) as typeof CSS.supports;
  });
  await page.goto("/");
  await toggle(page).click();
  await expect(stage(page)).toHaveAttribute("data-scene-static", "true");
  await expect(page.getByRole("status")).toContainText("静态展示");
});

for (const [width, height, screen] of [
  // 799×1000 的文章在 1005px 之下，够不到下沿；用 1200 高窗口验同一条横溢边界。
  [799, 1200, 768],
  [1199, 1000, 1440],
  [1200, 1000, 1440],
  [1920, 1000, 1920],
] as const) {
  test(`演出态 ${width}×${height} 不横溢，文章仍在首屏`, async ({ page }) => {
    if (screen < 768) await page.setViewportSize({ width, height });
    else await page.setViewportSize({ width, height });
    await page.goto("/");
    await enterPerformance(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await expect(page.locator("#journal article").first()).toBeInViewport();
    const zones = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll(".scene-plane")].map((plane) =>
        plane.getBoundingClientRect(),
      );
      return boxes.length;
    });
    expect(zones).toBe(3);
  });
}

test("窄桌面没有人物也保留演出与入口", async ({ page }) => {
  await page.setViewportSize({ width: 799, height: 1000 });
  await page.goto("/");
  expect(await page.locator("#waifu-canvas").count()).toBe(0);
  await enterPerformance(page);
  await expect(page.getByRole("heading", { name: "Asuna", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(799);
});

test.describe("演出态与人物泊位同时存在", () => {
  test.use({ showMascot: true, screen: { width: 1440, height: 1000 } });
  test("人物仍是 230×320 通道，演出不掩盖文章可点性", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 900, height: 1000 });
    await page.goto("/");
    const canvas = page.locator("#waifu-canvas");
    await expect(canvas).toBeVisible();
    await enterPerformance(page);
    await page.screenshot({ path: testInfo.outputPath("performance.png") });
    const box = (await canvas.boundingBox())!;
    expect(box.width).toBe(230);
    expect(box.height).toBe(320);
    const obscured = await page.evaluate(() => {
      const links = [...document.querySelectorAll<HTMLElement>(".public-main a")];
      return links.flatMap((element) => {
        const rect = element.getBoundingClientRect();
        const x = rect.x + rect.width / 2;
        const y = rect.y + rect.height / 2;
        if (!rect.width || x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return [];
        const hit = document.elementFromPoint(x, y);
        return hit && element.contains(hit) ? [] : [element.textContent];
      });
    });
    expect(obscured).toEqual([]);
    await page.keyboard.press("Escape");
    await page.screenshot({ path: testInfo.outputPath("reading.png") });
  });
});

test.describe("无 WebGL 降级", () => {
  test.use({ showMascot: true });
  test("看板娘退回静帧，不留空画布", async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        ...rest: unknown[]
      ) {
        return /^webgl/.test(type) ? null : original.call(this, type as "2d", ...(rest as []));
      } as typeof original;
    });
    await page.goto("/");
    const frame = page.locator(".mascot-frame");
    await expect(frame).toHaveAttribute("data-engine", "fallback");
    const poster = page.locator(".mascot-fallback");
    await expect(poster).toBeVisible();
    await expect
      .poll(() => poster.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth))
      .toBeGreaterThan(0);
    // 泊位照留，文章窗仍让出人物列。
    await expect
      .poll(() =>
        page
          .locator(".public-main-home")
          .evaluate((main) =>
            Number.parseFloat(getComputedStyle(main).getPropertyValue("--mascot-clearance")),
          ),
      )
      .toBeGreaterThan(0);
  });
});
