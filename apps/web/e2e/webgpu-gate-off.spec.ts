import { expect, test } from "./fixtures";

// 业务栈必须显式关闭准入，即使完全没有 WebGPU API 也能运行功能回归。
test("业务测试关闭闸门时，无 WebGPU API 仍显示首页", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "gpu", { configurable: true, value: undefined }),
  );
  await page.goto("/");
  await expect(page.locator(".reading-stage")).toBeVisible();
  await expect(page.locator(".webgpu-gate")).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-webgpu-gate", "blocked");
  await expect(page.locator(".public-chrome")).toBeVisible();
});
