import { expect, test } from "@playwright/test";

/**
 * WebGPU 闸门：无硬件适配器时整站只留拦截页。
 *
 * 无头 Chromium 只有 SwiftShader（fallback adapter），默认的 e2e 预览用
 * `WEBGPU_GATE=off` 起服务，否则整套用例都会被拦在门外；
 * 只有显式 `E2E_WEBGPU_GATE=on` 时这组用例才跑，验证闸门本身。
 */
const gateOn = process.env.E2E_WEBGPU_GATE === "on";

/** 闸门用例不装站点 fixture：这里要看的正是"页面根本没开始跑"的状态。 */
test.describe("WebGPU 闸门", () => {
  test.skip(!gateOn, "预览未开闸门（无头机没有硬件 GPU），跳过闸门用例");

  test("没有硬件适配器时首页被整屏拦下", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-webgpu-gate", "blocked");

    const gate = page.locator(".webgpu-gate");
    await expect(gate).toBeVisible();
    await expect(gate.getByRole("heading", { level: 1 })).toHaveText("这台设备暂时进不来");
    // 无头 Chromium 不给适配器（除非显式开 SwiftShader），所以这里是 no-adapter；
    // 拿到软件适配器的设备会落到 software。两者都算拦下，理由必须是具体的。
    await expect(gate).toHaveAttribute("data-webgpu-gate-reason", /^(software|no-adapter)$/);
    await expect(gate).toContainText("适配器");
    // 焦点必须落在闸门里，键盘用户不会困在"看不见的页面"上。
    await expect(gate.getByRole("button", { name: "重新检测" })).toBeFocused();

    // 被拦下的站点内容既不显示，也拿不到焦点。
    await expect(page.locator(".public-chrome")).toBeHidden();

    // 横向不溢出。
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.screenshot({ path: test.info().outputPath("gate-home.png"), fullPage: true });
  });

  test("其它路由同样被拦，重新检测仍拦住", async ({ page }) => {
    await page.goto("/blog");
    const gate = page.locator(".webgpu-gate");
    await expect(gate).toBeVisible();
    await expect(page.locator(".public-chrome")).toBeHidden();

    await gate.getByRole("button", { name: "重新检测" }).click();
    await expect(gate).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-webgpu-gate", "blocked");
    await page.screenshot({ path: test.info().outputPath("gate-blog.png"), fullPage: true });
  });

  test("矮屏上闸门页可滚动到底，不被裁掉", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/");
    const gate = page.locator(".webgpu-gate");
    await expect(gate).toBeVisible();

    // 卡片比视口高时，栅格居中会把顶部推到视口外，因此必须能滚到底部的脚注。
    const reach = await page.evaluate(() => {
      const box = document.querySelector(".webgpu-gate") as HTMLElement;
      box.scrollTop = box.scrollHeight;
      const foot = document.querySelector(".webgpu-gate-foot") as HTMLElement;
      const rect = foot.getBoundingClientRect();
      box.scrollTop = 0;
      const title = (
        document.querySelector(".webgpu-gate-title") as HTMLElement
      ).getBoundingClientRect();
      return {
        footBottom: Math.round(rect.bottom),
        viewport: window.innerHeight,
        titleTop: Math.round(title.top),
        scrollable: box.scrollHeight > box.clientHeight,
      };
    });
    expect(reach.titleTop).toBeGreaterThanOrEqual(0);
    expect(reach.footBottom).toBeLessThanOrEqual(reach.viewport + 1);
  });

  test("手机上闸门页同样不横向溢出", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const gate = page.locator(".webgpu-gate");
    await expect(gate).toBeVisible();

    const metrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      card: document.querySelector(".webgpu-gate-card")?.getBoundingClientRect().width ?? 0,
    }));
    expect(metrics.overflow).toBeLessThanOrEqual(0);
    expect(metrics.card).toBeLessThanOrEqual(390);
    await page.screenshot({ path: test.info().outputPath("gate-390.png"), fullPage: true });
  });
});

/** 反向保护：关闸门时必须真的不拦，否则正常预览会被这条用例以外的东西挡住。 */
test.describe("WebGPU 闸门已关闭", () => {
  test.skip(gateOn, "预览开闸门，跳过关闭态用例");

  test("关闸门时首页正常出内容", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".webgpu-gate")).toHaveCount(0);
    await expect(page.locator("html")).not.toHaveAttribute("data-webgpu-gate", "blocked");
    await expect(page.locator(".public-chrome")).toBeVisible();
  });
});
