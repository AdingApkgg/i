import { expect, test } from "./fixtures";

// 回归边界：桌面导航必须在正文左侧，手机导航必须固定在底部且不挤出页面。
for (const width of [320, 390, 768, 1023, 1024, 1440]) {
  test(`导航随视口切换位置（${width}px）`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/blog/hello-world");
    const header = page.locator("header");
    const main = page.locator("main");
    const box = await header.boundingBox();
    const content = await main.boundingBox();
    expect(box).not.toBeNull();
    expect(content).not.toBeNull();
    if (width >= 1024) {
      expect(box!.x).toBe(0);
      expect(box!.height).toBe(900);
      expect(box!.width).toBeLessThan(260);
      expect(content!.x).toBeGreaterThanOrEqual(box!.width);
    } else {
      expect(box!.y).toBeGreaterThan(800);
      expect(box!.y + box!.height).toBe(900);
      expect(box!.height).toBeLessThanOrEqual(100);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      expect((await header.boundingBox())!.y).toBe(box!.y);
      expect(
        (await main.boundingBox())!.y + (await main.boundingBox())!.height,
      ).toBeLessThanOrEqual(box!.y);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await expect(header.getByRole("link", { name: "博客", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
}

test("手机底栏能滑到末尾、键盘访问、客户端切页并回到首页", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    (window as unknown as { __marker: number }).__marker = 42;
  });
  const nav = page.locator("header nav");
  const friends = nav.getByRole("link", { name: "友链", exact: true });
  await friends.focus();
  await expect(friends).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/friends");
  await expect(friends).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: "音乐", exact: true }).click();
  await expect(page).toHaveURL("/music");
  await page.locator("header").getByRole("link", { name: "首页", exact: true }).click();
  await expect(page).toHaveURL("/");
  expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(42);
});

test("手机直达后面的栏目，当前项自动进入可见区", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/friends");
  const current = page.locator('header nav [aria-current="page"]');
  await expect(current).toHaveText("友链");
  await expect(current).toBeInViewport();
});

test("矮桌面侧栏可滚动到最后的栏目", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 480 });
  await page.goto("/");
  const friends = page.locator("header nav").getByRole("link", { name: "友链", exact: true });
  await friends.focus();
  await expect(friends).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/friends");
});
