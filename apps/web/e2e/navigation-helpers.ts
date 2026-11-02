import type { Page } from "@playwright/test";

/** 按用户实际路径展开菜单并点击；调用方独立断言目标 URL、播放状态等。 */
export async function navigateMain(page: Page, label: string, group?: string) {
  const nav = page.getByRole("navigation", { name: "主导航" });
  if (group) {
    const trigger = nav.getByRole("button", { name: group, exact: true });
    if (await trigger.isVisible()) {
      await trigger.click();
      await page.getByRole("dialog").getByRole("link", { name: label, exact: true }).click();
      return;
    }
    const summary = nav.locator("summary").filter({ hasText: group });
    if ((await summary.locator("..").getAttribute("open")) === null) await summary.click();
  }
  await nav.getByRole("link", { name: label, exact: true }).click();
}
