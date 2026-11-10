import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

// 捕捉三种独立回归：透明 Canvas 抢点、人物/气泡压字、开关面板重建模型。
// 字号与主阅读区不为浮动层让位；只允许已确认的下方两栏收窄。
async function expectClearReading(page: Page) {
  const result = await page.evaluate(() => {
    const links = [
      ...document.querySelectorAll<HTMLElement>(".public-main a, .public-main button"),
    ];
    const obscured = links.flatMap((element) => {
      const r = element.getBoundingClientRect();
      const x = r.x + r.width / 2;
      const y = r.y + r.height / 2;
      if (!r.width || !r.height || x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return [];
      const hit = document.elementFromPoint(x, y);
      return hit && element.contains(hit) ? [] : [{ text: element.textContent, hit: hit?.tagName }];
    });
    const protectedElements = [
      ...document.querySelectorAll<HTMLElement>(
        ".reading-identity > *, .reading-journal, .reading-lower > section, .reading-footer a",
      ),
    ];
    const layers = [...document.querySelectorAll<HTMLElement>("#waifu-canvas, .mascot-message")];
    const intersections = layers.flatMap((layer) => {
      const a = layer.getBoundingClientRect();
      if (!a.width || !a.height || getComputedStyle(layer).visibility === "hidden") return [];
      return protectedElements.flatMap((element) => {
        const b = element.getBoundingClientRect();
        return b.width &&
          b.height &&
          a.left < b.right &&
          a.right > b.left &&
          a.top < b.bottom &&
          a.bottom > b.top
          ? [{ layer: layer.id || layer.className, content: element.className || element.tagName }]
          : [];
      });
    });
    return { obscured, intersections };
  });
  expect(result.obscured, "正文入口不得被浮动层抢点，包含多行标题整块点击").toEqual([]);
  expect(result.intersections, "人物与气泡不得压在受保护阅读块上").toEqual([]);
}

for (const [width, height, colorScheme] of [
  [900, 1000, "light"],
  [1440, 1000, "dark"],
  [800, 1000, "light"],
  [900, 600, "dark"],
  [799, 1000, "light"],
] as const) {
  test.describe(`原尺寸泊位 ${width}×${height} ${colorScheme}`, () => {
    test.use({
      showMascot: true,
      screen: { width: 1440, height: 1000 },
      viewport: { width, height },
      colorScheme,
    });
    test("正文可点、人物气泡不压字，主动面板不重建 Canvas", async ({ page }, testInfo) => {
      await page.addInitScript(() =>
        localStorage.setItem(
          "i.mascot",
          JSON.stringify({
            state: { hidden: false, group: 0, costume: 1 },
            version: 0,
          }),
        ),
      );
      let coreReads = 0;
      page.on("request", (request) => {
        if (new URL(request.url()).pathname === "/live2d/core/live2d.min.js") coreReads++;
      });
      await page.goto("/");
      const canvas = page.locator("#waifu-canvas");
      await expect(canvas).toBeVisible();
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: testInfo.outputPath("visible-reading.png") });
      await expectClearReading(page);
      const box = (await canvas.boundingBox())!;
      // 出场弹簧动画落点在 1 附近，测量会带 1e-4 级子像素误差，用一位小数容差。
      expect(box.width, "不通过缩小人物换取绿灯").toBeCloseTo(230, 1);
      expect(box.height).toBeCloseTo(320, 1);
      const journal = (await page.locator(".reading-journal").boundingBox())!;
      const home = (await page.locator(".reading-home").boundingBox())!;
      // 文章窗只让出浮动人物实际占用的宽度（含 1px 余量），不再写死 320/250。
      const clearance = await page
        .locator(".public-main-home")
        .evaluate((main) =>
          Number.parseFloat(getComputedStyle(main).getPropertyValue("--mascot-clearance")),
        );
      expect(clearance, "人物可见时应有实际避让量").toBeGreaterThan(0);
      expect(journal.width, "主文章窗等宽让出泊位").toBeCloseTo(home.width - clearance - 1, 0);
      expect(journal.x + journal.width, "文章窗右缘不进入人物列").toBeLessThanOrEqual(
        home.x + home.width - clearance,
      );
      await canvas.evaluate((element) => {
        element.dataset.dockIdentity = "same-canvas";
      });
      const before = await page.locator(".reading-stage").boundingBox();
      const trigger = page.getByRole("button", { name: "看板娘工具与互动", exact: true });
      await trigger.focus();
      await page.keyboard.press("Enter");
      const panel = page.getByRole("dialog", { name: "看板娘工具与互动", exact: true });
      await expect(panel).toBeVisible();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(panel.getByRole("button", { name: "关闭互动面板", exact: true })).toBeFocused();
      await expect(canvas).toHaveAttribute("data-dock-identity", "same-canvas");
      await canvas.click({ position: { x: 115, y: 130 } });
      await page.screenshot({ path: testInfo.outputPath("active-tools.png") });
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(canvas).toBeVisible();
      await expect(canvas).toHaveAttribute("data-dock-identity", "same-canvas");
      expect(await page.locator(".reading-stage").boundingBox()).toEqual(before);
      for (const y of [400, 100000]) {
        await page.evaluate((top) => scrollTo(0, top), y);
        await page.waitForFunction(() => document.scrollingElement?.scrollTop !== 0);
        await expectClearReading(page);
      }
      expect(coreReads).toBe(1);
    });
  });
}

test.describe("浮动工具焦点与切页", () => {
  test.use({
    showMascot: true,
    screen: { width: 1440, height: 1000 },
    viewport: { width: 900, height: 1000 },
  });
  test("Tab 可达原工具、外部点击不抢焦点、切页关闭并保留模型", async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        "i.mascot",
        JSON.stringify({
          state: { hidden: false, group: 0, costume: 1 },
          version: 0,
        }),
      ),
    );
    await page.goto("/");
    const canvas = page.locator("#waifu-canvas");
    await expect(canvas).toBeVisible();
    await canvas.evaluate((element) => {
      element.dataset.dockIdentity = "same-canvas";
    });
    const trigger = page.getByRole("button", { name: "看板娘工具与互动", exact: true });
    await trigger.click();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "与看板娘互动", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "一言", exact: true })).toBeFocused();
    for (const name of ["打飞机", "换人", "换装", "拍照", "关于", "再见"]) {
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name, exact: true })).toBeFocused();
    }
    await page.keyboard.press("Escape");
    await trigger.click();
    const article = page.locator("[data-post-preview] h3 a").first();
    const href = await article.getAttribute("href");
    expect(href).toMatch(/^\/blog\//);
    await article.click();
    await expect(page).toHaveURL(href!);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(canvas).toHaveAttribute("data-dock-identity", "same-canvas");
    await expect(trigger).not.toBeFocused();
    await page.goBack();
    await expect(page).toHaveURL("/");
    // 退回来的是 SSR 首屏，等演出层挂载（水合完成）再点，免得点到未接线的按钮。
    await expect(page.locator(".reading-stage")).toHaveAttribute("data-scene-mode", "reading");
    // 不靠外部点击的 light-dismiss 掩盖切页关闭：打开后直接前进历史。
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await page.goForward();
    await expect(page).toHaveURL(href!);
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(canvas).toHaveAttribute("data-dock-identity", "same-canvas");
    await page.goBack();
    await expect(page).toHaveURL("/");
    await expect(page.locator(".reading-stage")).toHaveAttribute("data-scene-mode", "reading");
    for (const width of [799, 800, 390, 900]) {
      await trigger.focus();
      await page.setViewportSize({ width, height: 1000 });
      await expect(trigger).toBeVisible();
      await expect(trigger).toBeFocused();
      await expect(canvas).toHaveAttribute("data-dock-identity", "same-canvas");
    }
  });

  for (const native of [true, false]) {
    test(`非模态面板 ${native ? "原生 popover" : "Chromium 模拟缺少 popover API"} 保留外部表单焦点`, async ({
      page,
    }) => {
      await page.addInitScript((supported) => {
        if (!supported)
          Object.defineProperty(HTMLElement.prototype, "showPopover", {
            value: undefined,
            configurable: true,
          });
        localStorage.setItem(
          "i.mascot",
          JSON.stringify({ state: { hidden: false, group: 0, costume: 1 }, version: 0 }),
        );
      }, native);
      await page.goto("/");
      const canvas = page.locator("#waifu-canvas");
      await expect(canvas).toBeVisible();
      await canvas.evaluate((element) => {
        element.dataset.dockIdentity = "same-canvas";
      });
      // 仅测试夹具，不写入产品或数据；用于检查关闭非模态面板时不会抢表单焦点。
      await page.evaluate(() => {
        const input = document.createElement("input");
        input.setAttribute("aria-label", "测试焦点落点");
        Object.assign(input.style, {
          position: "fixed",
          left: "220px",
          top: "12px",
          width: "180px",
          height: "44px",
        });
        document.querySelector(".public-main")!.append(input);
      });
      const trigger = page.getByRole("button", { name: "看板娘工具与互动", exact: true });
      await trigger.click();
      const panel = page.getByRole("dialog", { name: "看板娘工具与互动", exact: true });
      await expect(panel).toBeVisible();
      if (native) await expect(panel).toHaveAttribute("popover", "auto");
      else await expect(panel).not.toHaveAttribute("popover", "auto");
      const input = page.getByRole("textbox", { name: "测试焦点落点", exact: true });
      await input.click();
      await expect(input).toBeFocused();
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await trigger.click();
      await page.keyboard.press("Escape");
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await trigger.click();
      await panel.getByRole("button", { name: "关闭互动面板", exact: true }).click();
      await expect(trigger).toBeFocused();
      await expect(canvas).toHaveAttribute("data-dock-identity", "same-canvas");
    });
  }
});
