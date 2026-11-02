import pg from "pg";
import { expect, test } from "./fixtures";
import { navigateMain } from "./navigation-helpers";

// 删除共享高亮或让它跟错活动项，应由真实几何位置断言捕获。
for (const width of [390, 1440]) {
  test(`主导航高亮跟随活动栏目，切页后落在链接内部（${width}px）`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/blog");
    const nav = page.getByRole("navigation", { name: "主导航" });
    await navigateMain(page, "音乐", "收藏");
    await expect(page).toHaveURL("/music");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const current =
      width < 1024
        ? nav.getByRole("button", { name: "收藏", exact: true })
        : nav.getByRole("link", { name: "音乐", exact: true });
    if (width < 1024) await expect(current).toHaveAttribute("data-active", "true");
    else await expect(current).toHaveAttribute("aria-current", "page");
    const highlight = current.locator("[data-nav-highlight]");
    await expect(highlight).toHaveCount(1);
    await expect
      .poll(async () => {
        const a = await current.boundingBox();
        const b = await highlight.boundingBox();
        if (!a || !b || b.width <= 0 || b.height <= 0) return false;
        return (
          b.x >= a.x - 1 &&
          b.y >= a.y - 1 &&
          b.x + b.width <= a.x + a.width + 1 &&
          b.y + b.height <= a.y + a.height + 1
        );
      })
      .toBe(true);
    await expect(nav.locator("[data-nav-highlight]:visible")).toHaveCount(1);
  });
}

test("兴趣地图响应键盘焦点、重绘连线并保留客户端路由", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const map = page.getByRole("navigation", { name: "兴趣地图" });
  await expect(map.getByRole("link")).toHaveCount(6);
  const branch = map.locator('[data-garden-branch="music"]');
  await expect
    .poll(() => branch.evaluate((el) => Number.parseFloat(getComputedStyle(el).strokeDashoffset)))
    .toBe(0);
  await map.getByRole("link", { name: "前往音乐", exact: true }).focus();
  await expect
    .poll(() => branch.evaluate((el) => Number.parseFloat(getComputedStyle(el).strokeDashoffset)))
    .toBeGreaterThan(0.05);
  await expect
    .poll(() => branch.evaluate((el) => Number.parseFloat(getComputedStyle(el).strokeDashoffset)))
    .toBe(0);
  await page.evaluate(() => {
    (window as unknown as { animationMarker: number }).animationMarker = 42;
  });
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/music");
  expect(
    await page.evaluate(() => (window as unknown as { animationMarker?: number }).animationMarker),
  ).toBe(42);
});

test("首页滚动推进章节线条，离开再返回不留下重复场景", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await page.goto("/");
  const rule = page.locator("[data-section-rule]").last();
  const scale = () =>
    rule.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a);
  await expect.poll(scale).toBeLessThan(0.2);
  await rule.scrollIntoViewIfNeeded();
  await expect.poll(scale).toBeGreaterThan(0.8);
  for (let i = 0; i < 2; i++) {
    await navigateMain(page, "博客", "日常");
    await expect(page).toHaveURL("/blog");
    await page.locator("header").getByRole("link", { name: "首页", exact: true }).click();
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("navigation", { name: "兴趣地图" })).toHaveCount(1);
  }
  await expect(page.locator(".pin-spacer")).toHaveCount(0);
});

test("减少动态效果时地图和章节完整静止，运行中切换也生效", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const map = page.getByRole("navigation", { name: "兴趣地图" });
  const branch = map.locator('[data-garden-branch="music"]');
  await expect(branch).toHaveCount(1);
  await map.getByRole("link", { name: "前往音乐", exact: true }).focus();
  await expect
    .poll(() => branch.evaluate((el) => Number.parseFloat(getComputedStyle(el).strokeDashoffset)))
    .toBe(0);
  const rule = page.locator("[data-section-rule]").last();
  expect(await rule.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a)).toBe(
    1,
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect
    .poll(() => rule.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a))
    .toBeLessThan(0.5);
  await map.getByRole("link", { name: "前往相册", exact: true }).focus();
  await map.getByRole("link", { name: "前往音乐", exact: true }).focus();
  await expect
    .poll(() => branch.evaluate((el) => Number.parseFloat(getComputedStyle(el).strokeDashoffset)))
    .toBeGreaterThan(0.05);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() => rule.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).a))
    .toBe(1);
  await expect
    .poll(() => branch.evaluate((el) => Number.parseFloat(getComputedStyle(el).strokeDashoffset)))
    .toBe(0);
});

test("禁用 JavaScript 仍能看见首屏正文并使用兴趣地图", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    const origin = new URL(baseURL!).origin;
    await page.route(
      (url) => url.origin !== origin,
      (route) => route.abort(),
    );
    await page.goto(baseURL!);
    await expect(page.getByRole("heading", { name: "Asuna", exact: true })).toBeVisible();
    const link = page
      .getByRole("navigation", { name: "兴趣地图" })
      .getByRole("link", { name: "前往音乐", exact: true });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(`${baseURL}/music`);
    await expect(page.getByRole("heading", { name: "音乐", exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("栏目标题的 SVG 签名绘制完成后保留完整图形", async ({ page }) => {
  await page.goto("/music");
  const flourish = page.locator("[data-title-flourish] path");
  await expect(flourish).toHaveCount(1);
  await expect
    .poll(() => flourish.evaluate((el) => Number.parseFloat(getComputedStyle(el).strokeDashoffset)))
    .toBe(0);
  await expect(page.getByRole("heading", { name: "音乐", exact: true })).toBeVisible();
});

test.describe("相册过渡与缩放", () => {
  const album = `animation-e2e-${Date.now()}`;
  test.beforeAll(async () => {
    const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    try {
      await db.query('INSERT INTO "Album" (id, name, "updatedAt") VALUES ($1, $1, now())', [album]);
      for (let i = 0; i < 2; i++)
        await db.query(
          'INSERT INTO "Photo" (id, title, "imageUrl", "albumId", "sortOrder", "updatedAt") VALUES ($1, $2, $3, $4, $5, now())',
          [`${album}-${i}`, `动效照片${i + 1}`, `/__animation-photo-${i}.svg`, album, i],
        );
    } finally {
      await db.end();
    }
  });
  test.afterAll(async () => {
    const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    try {
      await db.query('DELETE FROM "Photo" WHERE "albumId" = $1', [album]);
      await db.query('DELETE FROM "Album" WHERE id = $1', [album]);
    } finally {
      await db.end();
    }
  });
  test("切图过渡不抢占缩放手势，关闭后恢复焦点和滚动", async ({ page }) => {
    await page.route("**/__animation-photo-*.svg", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#e9a4bd"/></svg>',
      }),
    );
    await page.goto(`/gallery/${album}`);
    await page.waitForLoadState("networkidle");
    const trigger = page.getByRole("button", { name: "查看动效照片1", exact: true });
    await trigger.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("[data-photo-transition]")).toHaveCount(1);
    await dialog.getByRole("button", { name: "放大", exact: true }).click();
    await expect(dialog.getByText("150%", { exact: true })).toBeVisible();
    await dialog.getByRole("button", { name: "下一张", exact: true }).click();
    await expect(dialog).toHaveAttribute("aria-label", "动效照片2");
    await expect(dialog.getByText("100%", { exact: true })).toBeVisible();
    await expect
      .poll(() =>
        dialog
          .locator("[data-photo-transition]")
          .last()
          .evaluate((el) => getComputedStyle(el).opacity),
      )
      .toBe("1");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  });
});

for (const width of [320, 390, 1024, 1440]) {
  test(`首页动效布局无横向溢出，地图节点可点击（${width}px）`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const map = page.getByRole("navigation", { name: "兴趣地图" });
    await expect(map.getByRole("link", { name: "前往相册", exact: true })).toBeVisible();
    await map.getByRole("link", { name: "前往相册", exact: true }).click();
    await expect(page).toHaveURL("/gallery");
  });
}
