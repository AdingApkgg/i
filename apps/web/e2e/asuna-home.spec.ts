import { NAV_DOMAINS } from "@i/config";
import { expect, test } from "./fixtures";

// 已确认的阅读版替代旧兴趣地图／收藏首页契约；开工前原文件留存在本轮证据目录。
test("首屏同时可读真实文章与人物，主要入口进入真实页面", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Asuna", exact: true })).toBeVisible();
  const portrait = page.getByRole("img", { name: "亚丝娜 · 站内静帧", exact: true });
  await expect(portrait).toBeVisible();
  await expect
    .poll(() =>
      portrait.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    )
    .toBe(true);
  const first = page.locator("#journal article").first();
  await expect(first).toBeInViewport();
  await page.getByRole("link", { name: "读文章", exact: true }).click();
  await expect(page).toHaveURL(/\/#journal$/);
  await expect(first).toBeInViewport();
  await first.getByRole("link").click();
  await expect(page).toHaveURL(/\/blog\/[^/]+$/);
});

test("首页读取当前公开文章、说说与作品，不把随机相册或收藏冒充近况", async ({ page, request }) => {
  const responses = await Promise.all(
    ["blog/list", "moments/list", "project/list"].map((path) =>
      request.post(`/api/rpc/${path}`, { data: { json: {} } }),
    ),
  );
  for (const response of responses) expect(response.ok(), await response.text()).toBe(true);
  const [posts, moments, projects] = await Promise.all(
    responses.map(async (response) => (await response.json()).json),
  );
  expect(posts.length, "只读验收环境需要至少一篇已发布原文").toBeGreaterThan(0);
  await page.goto("/");
  await expect(page.locator("#journal h3")).toHaveText(
    posts.slice(0, 3).map((post: { title: string }) => post.title),
  );
  await expect(page.locator("#moments [data-moment-preview]")).toHaveCount(
    Math.min(2, moments.length),
  );
  await expect(page.locator("#projects h3")).toHaveText(
    projects.slice(0, 2).map((project: { name: string }) => project.name),
  );
  for (const post of posts.slice(0, 3))
    await expect(
      page.locator(`#journal a[href="/blog/${encodeURIComponent(post.slug)}"]`),
    ).toBeVisible();
  await expect(page.locator('img[src*="picsum.photos"]')).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /正在做|在听|在看|在玩/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "GitHub", exact: true }).first()).toHaveAttribute(
    "href",
    "https://github.com/AdingApkgg",
  );
  await page.getByRole("link", { name: "看作品", exact: true }).click();
  await expect(page).toHaveURL(/\/#projects$/);
  await page.locator("#projects").getByRole("link", { name: "全部作品", exact: true }).click();
  await expect(page).toHaveURL("/projects");
});

for (const width of [320, 390, 768, 799, 800, 1024, 1440, 1920]) {
  test(`阅读首页在 ${width}px 不溢出，文章和入口可直接操作`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await expect(page.locator("#journal article").first()).toBeInViewport();
    const read = page.getByRole("link", { name: "读文章", exact: true });
    const works = page.getByRole("link", { name: "看作品", exact: true });
    for (const link of [read, works]) {
      await expect(link).toBeVisible();
      const box = await link.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await read.focus();
    await expect(read).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/#journal$/);
    await expect(page.locator("#journal article").first()).toBeInViewport();
  });
}

test("桌面完整栏目初始可见，详情页的当前项不是固定首页", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "桌面主导航", exact: true });
  for (const domain of NAV_DOMAINS)
    await expect(nav.locator(`a[href="${domain.path}"]`)).toBeInViewport();
  for (const label of ["友链", "赞助", "关于"])
    await expect(nav.getByRole("link", { name: label, exact: true })).toBeInViewport();
  await page.locator("#journal article").first().getByRole("link").click();
  await expect(nav.locator('a[href="/blog"]')).toHaveAttribute("aria-current", "page");
  await expect(nav.locator('a[href="/"]')).not.toHaveAttribute("aria-current", "page");
});

test("手机全部栏目可点击、可键盘操作，Escape 返回打开按钮", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "栏目", exact: true });
  await trigger.click();
  const panel = page.getByRole("dialog", { name: "全部栏目", exact: true });
  await expect(panel).toBeVisible();
  for (const domain of NAV_DOMAINS) {
    const link = panel.locator(`a[href="${domain.path}"]`);
    await expect(link).toBeVisible();
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.keyboard.press("Escape");
  await expect(panel).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await page.keyboard.press("Enter");
  const album = panel.getByRole("link", { name: "相册", exact: true });
  await album.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/gallery");
  await expect(panel).not.toBeVisible();
  await trigger.click();
  await expect(panel.locator('a[href="/gallery"]')).toHaveAttribute("aria-current", "page");
  await page.setViewportSize({ width: 800, height: 1000 });
  await expect(panel).not.toBeVisible();
  await expect(page.getByRole("navigation", { name: "桌面主导航", exact: true })).toBeVisible();
});

test("系统浅深色即时生效，人物不染暗，后台主题不受影响", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
    "rgb(232, 238, 240)",
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .toBe("rgb(31, 43, 52)");
  expect(
    await page.locator(".reading-portrait img").evaluate((image) => getComputedStyle(image).filter),
  ).not.toMatch(/brightness|grayscale|sepia/);
  for (const path of ["/music", "/blog", "/gallery", "/projects", "/not-a-real-page-sao-review"]) {
    await page.goto(path);
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
      "rgb(31, 43, 52)",
    );
    await expect(page.getByRole("navigation", { name: "桌面主导航", exact: true })).toBeVisible();
  }
  await page.goto("/dash/login");
  await expect(page.locator(".sao-site")).toHaveCount(0);
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(
    "rgb(31, 43, 52)",
  );
  await expect(page.getByRole("button", { name: "登录", exact: true })).toBeVisible();
});

test("禁用脚本仍有真实首篇和完整栏目，收起导航后可直接阅读", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: { width: 390, height: 1000 },
  });
  try {
    await context.route(
      (url) => url.origin !== new URL(baseURL!).origin,
      (route) => route.abort(),
    );
    const page = await context.newPage();
    await page.goto("/");
    const fallback = page.getByRole("navigation", { name: "无脚本全部栏目", exact: true });
    for (const domain of NAV_DOMAINS)
      await expect(fallback.locator(`a[href="${domain.path}"]`)).toBeVisible();
    await page
      .locator("summary")
      .filter({ hasText: /^全部栏目$/ })
      .click();
    await expect(page.locator("#journal article").first()).toBeInViewport();
    await page.locator("#journal article").first().getByRole("link").click();
    await expect(page).toHaveURL(/\/blog\/[^/]+$/);
  } finally {
    await context.close();
  }
});
