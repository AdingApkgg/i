import { expect, test } from "./fixtures";

/**
 * /design 是设计系统的活文档：三层 token 与四层构件都在这里可见。
 * 一是防止构件被改坏（DOM 契约），二是给出视觉基线（toHaveScreenshot），
 * 三是保证预览页本身在任何宽度下都不横向溢出。
 */
const SHOT = { animations: "disabled", caret: "hide", fullPage: true } as const;

test.describe("设计系统预览页", () => {
  test("三层 token 与六个模式构件都可渲染", async ({ page }) => {
    const response = await page.goto("/design");
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText("设计系统");

    // 模式构件：每个一块，且各自的关键 DOM 存在
    for (const id of [
      "page-header",
      "section-header",
      "status-badge",
      "empty-state",
      "toolbar",
      "stat-tile",
    ]) {
      await expect(page.getByTestId(`pattern-${id}`)).toBeVisible();
    }
    await expect(
      page.getByTestId("pattern-status-badge").getByText("运行中", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByTestId("pattern-empty-state").getByText("还没有记录", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByTestId("pattern-stat-tile").getByText("1 284", { exact: true }),
    ).toBeVisible();

    // 刻度与语义色区块
    await expect(page.getByTestId("tone-swatches").getByTestId("swatch")).toHaveCount(6);
    await expect(page.getByTestId("tone-swatches").locator("[data-tone]")).toHaveCount(6);
    await expect(page.getByTestId("text-scale").getByText("正文 body")).toBeVisible();
  });

  test("语义色跟随主题：亮/暗下 primary 计算值不同", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/design");
    const primary = page.getByTestId("tone-swatches").locator('[data-tone="primary"]');
    await expect(primary).toBeVisible();
    // 取实际色块而非透明外层；回读 alpha，防止两个不同的透明值冒充有效主题色。
    const sample = () =>
      primary.evaluate((element) => {
        const color = getComputedStyle(element).backgroundColor;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d")!;
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return { color, alpha: context.getImageData(0, 0, 1, 1).data[3] };
      });
    const light = await sample();
    expect(light.alpha).toBe(255);

    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(async () => (await sample()).color).not.toBe(light.color);
    const dark = await sample();
    expect(dark.alpha).toBe(255);
    expect(light.color).not.toBe(dark.color);
  });

  test("桌面：整页视觉基线且不横向溢出", async ({ page }) => {
    await page.goto("/design");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expect(page).toHaveScreenshot("design-desktop.png", SHOT);
  });

  test("移动：整页视觉基线且不横向溢出", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/design");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expect(page).toHaveScreenshot("design-mobile.png", SHOT);
  });

  test("暗色：整页视觉基线", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/design");
    await expect(page).toHaveScreenshot("design-dark.png", SHOT);
  });
});
