import { NAV_DOMAINS } from "@i/config";
import { expect, test } from "./fixtures";

// 已确认契约迁移：分组初始展开、完整注册表，不再锁死旧十二栏目或单组互斥。
test("桌面初始展开全部栏目，用户仍可收起并重新展开分组", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "桌面主导航", exact: true });
  for (const domain of NAV_DOMAINS) {
    const link = nav.locator(`a[href="${domain.path}"]`);
    await expect(link).toBeVisible();
    await expect(link).toHaveText(/\S/);
  }
  const collection = nav.locator("details").filter({ has: page.locator('a[href="/music"]') });
  await collection.locator("summary").click();
  await expect(collection.getByRole("link", { name: "音乐", exact: true })).not.toBeVisible();
  await collection.locator("summary").click();
  await expect(collection.getByRole("link", { name: "音乐", exact: true })).toBeVisible();
  await expect(nav.getByRole("link")).toHaveCount(NAV_DOMAINS.length + 2);
});

test("直达真实详情自动标记文章栏目，键盘切页保留客户端上下文", async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = await request.post("/api/rpc/blog/list", { data: { json: {} } });
  const posts = (await response.json()).json as { slug: string }[];
  expect(posts.length).toBeGreaterThan(0);
  await page.goto(`/blog/${encodeURIComponent(posts[0]!.slug)}`);
  const nav = page.getByRole("navigation", { name: "桌面主导航", exact: true });
  await expect(nav.getByRole("link", { name: "博客", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.evaluate(() => {
    (window as unknown as { previewMarker: number }).previewMarker = 42;
  });
  const music = nav.getByRole("link", { name: "音乐", exact: true });
  await music.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/music");
  await expect(music).toHaveAttribute("aria-current", "page");
  expect(
    await page.evaluate(() => (window as unknown as { previewMarker?: number }).previewMarker),
  ).toBe(42);
  await page.goBack();
  await expect(nav.getByRole("link", { name: "博客", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("手机完整菜单焦点受控，关闭后返回触发按钮，切到桌面不残留模态层", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "栏目", exact: true });
  await trigger.click();
  const panel = page.getByRole("dialog", { name: "全部栏目", exact: true });
  for (const domain of NAV_DOMAINS)
    await expect(panel.locator(`a[href="${domain.path}"]`)).toBeVisible();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    expect(await panel.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await panel.getByRole("link", { name: "博客", exact: true }).click();
  await expect(page).toHaveURL("/blog");
  await expect(panel).toHaveCount(0);
  await trigger.click();
  await page.setViewportSize({ width: 800, height: 900 });
  await expect(panel).toHaveCount(0);
  expect(await page.evaluate(() => getComputedStyle(document.body).pointerEvents)).not.toBe("none");
});

for (const width of [320, 390, 768, 799, 800, 1024, 1440]) {
  test(`分组与正文在 ${width}px 不横溢，完整栏目仍可操作`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    if (width < 800) {
      await page.getByRole("button", { name: "栏目", exact: true }).click();
      const music = page.getByRole("dialog").getByRole("link", { name: "音乐", exact: true });
      await music.focus();
      await expect(music).toBeInViewport();
    } else {
      const nav = page.getByRole("navigation", { name: "桌面主导航", exact: true });
      await expect(nav.getByRole("link", { name: "音乐", exact: true })).toBeVisible();
      expect((await page.locator(".public-sidebar").boundingBox())!.width).toBeLessThanOrEqual(164);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}

test("无脚本完整菜单保留所有注册入口，手机和桌面都能进入栏目", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  try {
    await page.route(
      (url) => url.origin !== new URL(baseURL!).origin,
      (route) => route.abort(),
    );
    await page.goto(baseURL!);
    const nav = page.getByRole("navigation", { name: "无脚本全部栏目", exact: true });
    await expect(nav.getByRole("link")).toHaveCount(NAV_DOMAINS.length + 2);
    for (const domain of NAV_DOMAINS)
      await expect(nav.locator(`a[href="${domain.path}"]`)).toBeVisible();
    await nav.getByRole("link", { name: "设备", exact: true }).click();
    await expect(page).toHaveURL(`${baseURL}/device`);
    await page
      .getByRole("navigation", { name: "无脚本全部栏目", exact: true })
      .getByRole("link", { name: "首页", exact: true })
      .click();
    await expect(page).toHaveURL(`${baseURL}/`);
    await page.setViewportSize({ width: 1440, height: 900 });
    const desktop = page.getByRole("navigation", { name: "桌面主导航", exact: true });
    await desktop.getByRole("link", { name: "音乐", exact: true }).click();
    await expect(page).toHaveURL(`${baseURL}/music`);
  } finally {
    await context.close();
  }
});
