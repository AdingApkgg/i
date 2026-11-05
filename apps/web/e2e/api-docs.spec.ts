/**
 * 后台 API 文档页：Scalar 从 /api/openapi.json 渲染可试打的操作列表。
 *
 * 只验「页面能用」：文档壳挂上、标题在、确有接口条目、配色跟随后台壳而不是 Scalar 自带主题。
 */
import { expect, test } from "@playwright/test";
import { ADMIN_STATE } from "./fixtures";

test.describe("后台 API 文档", () => {
  test.use({ storageState: ADMIN_STATE });

  test("文档页渲染接口列表并沿用后台配色", async ({ page }) => {
    await page.goto("/dash/api-docs");

    await expect(page.getByRole("heading", { name: "API 文档" })).toBeVisible();

    // Scalar 是动态引入的，等它把 openapi.json 渲染成操作列表
    const app = page.locator(".scalar-app.scalar-api-reference");
    await expect(app).toBeVisible({ timeout: 30_000 });
    await expect(app.locator("a[href^='#']").first()).toBeVisible({ timeout: 30_000 });

    // 背景必须等于后台壳的 --background，证明 token 映射盖住了 Scalar 默认主题
    const [docBg, shellBg] = await page.evaluate(() => {
      const shell = document.querySelector(".dash-shell");
      const docs = document.querySelector(".dash-api-docs");
      const read = (el: Element | null) =>
        el ? getComputedStyle(el).getPropertyValue("--background").trim() : "";
      return [read(docs), read(shell)];
    });
    expect(docBg).not.toBe("");
    expect(docBg).toBe(shellBg);

    const bg = await page
      .locator(".dash-api-docs .scalar-app")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
  });

  test("深色下文档不退回 Scalar 自带主题", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/dash/api-docs");
    await expect(page.locator(".scalar-app.scalar-api-reference")).toBeVisible({ timeout: 30_000 });

    const [docBg, shellBg] = await page.evaluate(() => {
      const shell = document.querySelector(".dash-shell");
      const docs = document.querySelector(".dash-api-docs");
      const read = (el: Element | null) =>
        el ? getComputedStyle(el).getPropertyValue("--background").trim() : "";
      return [read(docs), read(shell)];
    });
    expect(docBg).toBe(shellBg);

    // #f6f7f9 是后台浅色底；深色下必须不是它
    const bg = await page
      .locator(".dash-api-docs .scalar-app")
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe("rgb(246, 247, 249)");
  });
});
