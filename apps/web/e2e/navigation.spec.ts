import { expect, test } from "./fixtures";
import { navigateMain } from "./navigation-helpers";

// 已确认契约迁移：手机底栏 → 顶部完整菜单，1024 → 800px；仍验证正文避让和当前栏目。
for (const width of [320, 390, 768, 799, 800, 1023, 1024, 1440]) {
  test(`导航与正文在 800px 版式边界切换（${width}px）`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/blog");
    const main = (await page.locator(".public-main").boundingBox())!;
    if (width >= 800) {
      const sidebar = page.locator(".public-sidebar");
      await expect(sidebar).toBeVisible();
      const box = (await sidebar.boundingBox())!;
      expect(main.x).toBeGreaterThanOrEqual(box.x + box.width);
      expect(box.width).toBeLessThanOrEqual(164);
      expect(box.y).toBe(34);
      await expect(sidebar.getByRole("link", { name: "博客", exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await page.evaluate(() => scrollTo(0, document.body.scrollHeight));
      expect((await sidebar.boundingBox())!.y).toBe(box.y);
    } else {
      await expect(page.locator(".public-sidebar")).not.toBeVisible();
      const header = (await page.locator(".public-mobile-header").boundingBox())!;
      expect(header.y).toBe(0);
      expect(main.y).toBeGreaterThanOrEqual(header.y + header.height);
      await page.getByRole("button", { name: "栏目", exact: true }).click();
      await expect(
        page.getByRole("dialog").getByRole("link", { name: "博客", exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await page.keyboard.press("Escape");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--site-nav-height").trim(),
      ),
    ).toBe("0px");
  });
}

test("手机完整菜单支持键盘，跨栏目切页后能回首页且不整页重载", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(() => {
    (window as unknown as { navigationMarker: number }).navigationMarker = 42;
  });
  const trigger = page.getByRole("button", { name: "栏目", exact: true });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const friends = page.getByRole("dialog").getByRole("link", { name: "友链", exact: true });
  await friends.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/friends");
  await trigger.click();
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "友链", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page.keyboard.press("Escape");
  await navigateMain(page, "音乐", "收藏");
  await expect(page).toHaveURL("/music");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await navigateMain(page, "首页");
  await expect(page).toHaveURL("/");
  expect(
    await page.evaluate(
      () => (window as unknown as { navigationMarker?: number }).navigationMarker,
    ),
  ).toBe(42);
});

test("手机直达二级栏目后可找到当前项，不把首页标成当前页", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/device");
  await page.getByRole("button", { name: "栏目", exact: true }).click();
  const panel = page.getByRole("dialog");
  const current = panel.getByRole("link", { name: "设备", exact: true });
  await expect(current).toHaveAttribute("aria-current", "page");
  await current.focus();
  await expect(current).toBeInViewport();
  await expect(panel.getByRole("link", { name: "首页", exact: true })).not.toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("矮桌面导航可以滚动并聚焦最后的栏目", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 480 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "桌面主导航", exact: true });
  const about = nav.getByRole("link", { name: "关于", exact: true });
  await about.focus();
  await expect(about).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/about");
});
