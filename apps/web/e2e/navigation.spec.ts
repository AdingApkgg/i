import { expect, test } from "./fixtures";

// 保留正文避让、固定位置和活动栏目验证；手机活动叶子位于分组面板中。
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
      expect(box!.width).toBeLessThanOrEqual(192);
      expect(content!.x).toBeGreaterThanOrEqual(box!.width);
      await expect(header.getByRole("link", { name: "博客", exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
    } else {
      expect(box!.y).toBeGreaterThan(800);
      expect(box!.y + box!.height).toBe(900);
      expect(box!.height).toBeLessThanOrEqual(100);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      expect((await header.boundingBox())!.y).toBe(box!.y);
      expect(
        (await main.boundingBox())!.y + (await main.boundingBox())!.height,
      ).toBeLessThanOrEqual(box!.y);
      const group = header.getByRole("button", { name: "日常", exact: true });
      await expect(group).toHaveAttribute("data-active", "true");
      await group.click();
      await expect(
        page.getByRole("dialog").getByRole("link", { name: "博客", exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await page.keyboard.press("Escape");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}

test("手机底栏与分组面板可键盘访问，客户端切页后能回首页", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    (window as unknown as { __marker: number }).__marker = 42;
  });
  const nav = page.getByRole("navigation", { name: "主导航" });
  const friends = nav.getByRole("link", { name: "友链", exact: true });
  await friends.focus();
  await expect(friends).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/friends");
  await expect(friends).toHaveAttribute("aria-current", "page");
  await nav.getByRole("button", { name: "收藏", exact: true }).focus();
  await page.keyboard.press("Enter");
  const music = page.getByRole("dialog").getByRole("link", { name: "音乐", exact: true });
  await music.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/music");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav.getByRole("link", { name: "首页", exact: true }).click();
  await expect(page).toHaveURL("/");
  expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(42);
});

test("手机直达二级栏目，底栏标明所属组且能找到当前页", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/device");
  const group = page
    .getByRole("navigation", { name: "主导航" })
    .getByRole("button", { name: "兴趣", exact: true });
  await expect(group).toHaveAttribute("data-active", "true");
  await expect(group).toBeInViewport();
  await group.click();
  const current = page.getByRole("dialog").getByRole("link", { name: "设备", exact: true });
  await expect(current).toHaveAttribute("aria-current", "page");
  await expect(current).toBeInViewport();
});

test("矮桌面展开分组后仍能滚动和聚焦最后的栏目", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 480 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "主导航" });
  await nav.locator("summary").filter({ hasText: "收藏" }).click();
  const friends = nav.getByRole("link", { name: "友链", exact: true });
  await friends.focus();
  await expect(friends).toBeInViewport();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/friends");
});
