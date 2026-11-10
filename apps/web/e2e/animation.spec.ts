import type { Locator } from "@playwright/test";
import pg from "pg";
import { expect, test } from "./fixtures";
import { navigateMain } from "./navigation-helpers";

// 检查真实绘制结果的时间变化；只改 data 属性或暂停文案不能让启停测试通过。
const motionChanges = (motion: Locator) =>
  motion.evaluate(async (element) => {
    const before = getComputedStyle(element).transform;
    await new Promise((resolve) => window.setTimeout(resolve, 160));
    return getComputedStyle(element).transform !== before;
  });

const cameraOffset = (camera: Locator) =>
  camera.evaluate((element) => {
    const matrix = new DOMMatrixReadOnly(getComputedStyle(element).transform);
    return Math.hypot(matrix.m41, matrix.m42);
  });

// 当前高亮属于链接自身，不再有旧导航的共享滑块。
for (const width of [390, 1440]) {
  test(`主导航高亮跟随活动栏目，旧栏目不残留高亮（${width}px）`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/blog");
    await navigateMain(page, "音乐", "收藏");
    await expect(page).toHaveURL("/music");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    if (width < 800) await page.getByRole("button", { name: "栏目", exact: true }).click();
    const nav = page.getByRole("navigation", {
      name: width < 800 ? "手机全部栏目" : "桌面主导航",
      exact: true,
    });
    const music = nav.getByRole("link", { name: "音乐", exact: true });
    const blog = nav.getByRole("link", { name: "博客", exact: true });
    await expect(music).toHaveAttribute("aria-current", "page");
    await expect(music).toHaveCSS("text-decoration-line", "underline");
    await expect(music).toHaveCSS("font-weight", "600");
    await expect(blog).not.toHaveAttribute("aria-current", "page");
    await expect(blog).toHaveCSS("text-decoration-line", "none");
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    await blog.click();
    await expect(page).toHaveURL("/blog");
    if (width < 800) await page.getByRole("button", { name: "栏目", exact: true }).click();
    await expect(blog).toHaveCSS("text-decoration-line", "underline");
    await expect(music).toHaveCSS("text-decoration-line", "none");
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  });
}

// 丢失焦点样式、键盘激活或把 Link 改成整页刷新，都必须报错。
test("公开栏目响应键盘焦点并保留客户端路由", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByRole("group", { name: "首页演出控制" })).toBeVisible();
  const music = page
    .getByRole("navigation", { name: "桌面主导航", exact: true })
    .getByRole("link", { name: "音乐", exact: true });
  await page.keyboard.press("Tab");
  await music.focus();
  await expect(music).toBeFocused();
  await expect(music).toHaveCSS("outline-style", "solid");
  await expect(music).toHaveCSS("outline-width", "2px");
  await page.evaluate(() => {
    (window as unknown as { animationMarker: number }).animationMarker = 42;
  });
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/music");
  await expect(page.getByRole("heading", { name: "音乐", exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => (window as unknown as { animationMarker?: number }).animationMarker),
  ).toBe(42);
});

test("演出由键盘开启，视点跟随指针，暂停和返回阅读真正停动", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const controls = page.getByRole("group", { name: "首页演出控制" });
  const toggle = controls.getByRole("button", { name: "演出模式", exact: true });
  const motion = page.locator(".scene-field-motion");
  const camera = page.locator(".scene-camera");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(controls.getByRole("button", { name: "暂停动态", exact: true })).toBeDisabled();
  await page.mouse.move(400, 300);
  await expect.poll(() => cameraOffset(camera)).toBe(0);
  await expect.poll(() => motionChanges(motion)).toBe(false);
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => motionChanges(motion)).toBe(true);
  await page.mouse.move(550, 350);
  await expect.poll(() => cameraOffset(camera)).toBeGreaterThan(0);
  await controls.getByRole("button", { name: "暂停动态", exact: true }).click();
  const resume = controls.getByRole("button", { name: "继续动态", exact: true });
  await expect(resume).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => motionChanges(motion)).toBe(false);
  await expect.poll(() => cameraOffset(camera)).toBe(0);
  await page.mouse.move(600, 400);
  await expect.poll(() => cameraOffset(camera)).toBe(0);
  await resume.click();
  await expect.poll(() => motionChanges(motion)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toBeFocused();
  await expect.poll(() => motionChanges(motion)).toBe(false);
  await toggle.click();
  await expect.poll(() => motionChanges(motion)).toBe(true);
  await controls.getByRole("button", { name: "返回阅读", exact: true }).click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toBeFocused();
  await expect.poll(() => motionChanges(motion)).toBe(false);
});

// 观察整个长 stage 而不是首屏 field，会在这里暴露离屏仍运行的回归。
test("演出离开首屏停动、回顶恢复，客户端往返后只有一套可用控制", async ({ page }) => {
  // 最小 seed 的正文很短，用短窗保证首屏确实可以完全离开视口。
  await page.setViewportSize({ width: 1440, height: 360 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const controls = page.getByRole("group", { name: "首页演出控制" });
  const toggle = controls.getByRole("button", { name: "演出模式", exact: true });
  const motion = page.locator(".scene-field-motion");
  await toggle.click();
  await expect.poll(() => motionChanges(motion)).toBe(true);
  const top = page.getByRole("link", { name: "回到顶部", exact: true });
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect(page.locator(".scene-field")).not.toBeInViewport();
  await expect(controls.getByRole("status")).toContainText("演出已暂歇");
  await expect.poll(() => motionChanges(motion)).toBe(false);
  await top.click();
  await expect(toggle).toBeInViewport();
  await expect.poll(() => motionChanges(motion)).toBe(true);
  await page.evaluate(() => {
    (window as unknown as { animationMarker: number }).animationMarker = 42;
  });
  for (let i = 0; i < 2; i++) {
    await navigateMain(page, "博客", "日常");
    await expect(page).toHaveURL("/blog");
    await expect(controls).toHaveCount(0);
    await navigateMain(page, "首页");
    await expect(page).toHaveURL("/");
    await expect(controls).toHaveCount(1);
    await expect(page.locator(".scene-field")).toHaveCount(1);
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => motionChanges(motion)).toBe(false);
    await toggle.click();
    await expect.poll(() => motionChanges(motion)).toBe(true);
  }
  // 两次重挂载后，Escape 返回阅读及焦点恢复仍须有效。
  await page.keyboard.press("Escape");
  await expect(toggle).toBeFocused();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => motionChanges(motion)).toBe(false);
  expect(
    await page.evaluate(() => (window as unknown as { animationMarker?: number }).animationMarker),
  ).toBe(42);
});

test("减少动态偏好在演出中双向切换，静态构图不妨碍阅读入口", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const controls = page.getByRole("group", { name: "首页演出控制" });
  const toggle = controls.getByRole("button", { name: "演出模式", exact: true });
  const pause = controls.getByRole("button", { name: "暂停动态", exact: true });
  const motion = page.locator(".scene-field-motion");
  const camera = page.locator(".scene-camera");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(pause).toBeDisabled();
  await expect(controls.getByRole("status")).toContainText("减少动态");
  await expect.poll(() => motionChanges(motion)).toBe(false);
  await expect(camera).toHaveCSS("transform", "none");
  await expect(page.locator(".scene-plane-far")).toHaveCSS("transform", "none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect(pause).toBeEnabled();
  await expect.poll(() => motionChanges(motion)).toBe(true);
  await page.mouse.move(550, 350);
  await expect.poll(() => cameraOffset(camera)).toBeGreaterThan(0);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(pause).toBeDisabled();
  await expect.poll(() => motionChanges(motion)).toBe(false);
  await page.mouse.move(600, 400);
  await expect(camera).toHaveCSS("transform", "none");
  await expect(page.locator(".scene-plane-far")).toHaveCSS("transform", "none");
  await page.getByRole("link", { name: "读文章", exact: true }).click();
  await expect(page).toHaveURL(/\/#journal$/);
  await expect(page.locator("#journal article").first()).toBeInViewport();
});

for (const width of [390, 1440]) {
  test(`禁用 JavaScript 仍能通过真实栏目和文章链接导航（${width}px）`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      locale: "zh-CN",
      javaScriptEnabled: false,
      viewport: { width, height: 900 },
    });
    try {
      const origin = new URL(baseURL!).origin;
      await context.route(
        (url) => url.origin !== origin,
        (route) => route.abort(),
      );
      const page = await context.newPage();
      await page.goto("/");
      await expect(page.getByRole("heading", { name: "Asuna", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "演出模式", exact: true })).toHaveCount(0);
      const nav = page.getByRole("navigation", {
        name: width < 800 ? "无脚本全部栏目" : "桌面主导航",
        exact: true,
      });
      const music = nav.getByRole("link", { name: "音乐", exact: true });
      await expect(music).toHaveAttribute("href", "/music");
      await music.click();
      await expect(page).toHaveURL("/music");
      await expect(page.getByRole("heading", { name: "音乐", exact: true })).toBeVisible();
      await nav.getByRole("link", { name: "首页", exact: true }).click();
      await expect(page).toHaveURL("/");
      if (width < 800) {
        await page.locator(".public-nav-fallback > summary").click();
        await expect(nav).not.toBeVisible();
      }
      const read = page.getByRole("link", { name: "读文章", exact: true });
      await expect(read).toHaveAttribute("href", /^\/?#journal$/);
      await read.click();
      await expect(page).toHaveURL(/\/#journal$/);
      const article = page.locator("#journal article").first();
      await expect(article).toBeInViewport();
      const title = (await article.getByRole("heading").textContent())!.trim();
      expect(title).not.toBe("");
      await article.getByRole("link").click();
      await expect(page).toHaveURL(/\/blog\/[^/]+$/);
      await expect(page.getByRole("heading", { name: title, exact: true }).first()).toBeVisible();
    } finally {
      await context.close();
    }
  });
}

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
  test(`演出布局无横向溢出，阅读、作品和相册入口可点击（${width}px）`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/");
    const controls = page.getByRole("group", { name: "首页演出控制" });
    await controls.getByRole("button", { name: "演出模式", exact: true }).click();
    await expect(controls.getByRole("status")).toContainText("演出中");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.evaluate(() => {
      (window as unknown as { animationMarker: number }).animationMarker = 42;
    });
    await page.getByRole("link", { name: "读文章", exact: true }).click();
    await expect(page).toHaveURL(/\/#journal$/);
    const article = page.locator("#journal article").first();
    await expect(article).toBeInViewport();
    await article.getByRole("link").click();
    await expect(page).toHaveURL(/\/blog\/[^/]+$/);
    await navigateMain(page, "首页");
    await expect(page).toHaveURL("/");
    await page.getByRole("button", { name: "演出模式", exact: true }).click();
    // 不伪造首页内容：有公开作品时定位到作品区，否则验证直达列表的入口。
    const hasProjects = (await page.getByRole("region", { name: "作品", exact: true }).count()) > 0;
    const works = page.getByRole("link", { name: "看作品", exact: true });
    await expect(works).toHaveAttribute("href", hasProjects ? /^\/?#projects$/ : "/projects");
    await works.click();
    if (hasProjects) {
      await expect(page).toHaveURL(/\/#projects$/);
      const projects = page.getByRole("region", { name: "作品", exact: true });
      await expect(projects).toBeInViewport();
      await projects.getByRole("link", { name: "全部作品", exact: true }).click();
    }
    await expect(page).toHaveURL("/projects");
    await expect(page.getByRole("heading", { name: "作品", exact: true })).toBeVisible();
    await navigateMain(page, "首页");
    await expect(page).toHaveURL("/");
    await page.getByRole("button", { name: "演出模式", exact: true }).click();
    await navigateMain(page, "相册", "日常");
    await expect(page).toHaveURL("/gallery");
    await expect(page.getByRole("heading", { name: "相册", exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => (window as unknown as { animationMarker?: number }).animationMarker,
      ),
    ).toBe(42);
  });
}
