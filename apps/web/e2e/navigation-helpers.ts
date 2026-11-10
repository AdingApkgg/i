import type { Page } from "@playwright/test";

/** 走已确认的侧栏／手机完整菜单；保留第三参以兼容播放器等已有调用。 */
export async function navigateMain(page: Page, label: string, _group?: string) {
  const desktop = page.getByRole("navigation", { name: "桌面主导航", exact: true });
  if (await desktop.isVisible()) {
    await desktop.getByRole("link", { name: label, exact: true }).click();
    return;
  }
  await page.getByRole("button", { name: "栏目", exact: true }).click();
  await page
    .getByRole("dialog", { name: "全部栏目", exact: true })
    .getByRole("link", { name: label, exact: true })
    .click();
}
