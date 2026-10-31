import { expect, test } from "./fixtures";

// 缺失主行动入口、插画遮挡链接或移动端正文溢出都应让这些行为测试失败。
test("首屏由人物与行动入口组成，可以直接进入兴趣区域", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("heading", { name: "Asuna", exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "白与绯红的剑士：Asuna", exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator(".asuna-character")
        .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    )
    .toBe(true);
  await page.getByRole("link", { name: "探索我的世界", exact: true }).click();
  await expect(page).toHaveURL(/\/#world$/);
  await expect(page.getByRole("navigation", { name: "兴趣地图" })).toBeInViewport();
  await page
    .getByRole("navigation", { name: "兴趣地图" })
    .getByRole("link", { name: "前往音乐", exact: true })
    .click();
  await expect(page).toHaveURL("/music");
});

test("新首页保留真实近况、照片、文章和个人入口", async ({ page }) => {
  await page.goto("/");
  for (const title of ["最近沉浸的事", "把日常存档", "写给自己的存档", "此刻的碎念"]) {
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("link", { name: /你好，世界/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "GitHub", exact: true }).first()).toHaveAttribute(
    "href",
    "https://github.com/AdingApkgg",
  );
  await page.getByRole("link", { name: "读最近的文字", exact: true }).click();
  await expect(page).toHaveURL(/\/#journal$/);
  await expect(page.getByRole("heading", { name: "写给自己的存档", exact: true })).toBeInViewport();
  await page
    .getByRole("link", { name: /^查看相册：/ })
    .first()
    .click();
  await expect(page).toHaveURL("/gallery");
});

for (const width of [320, 390, 768, 1024, 1440, 1920]) {
  test(`Asuna 首页在 ${width}px 不溢出，主要入口没有被插画覆盖`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const cta = page.getByRole("link", { name: "探索我的世界", exact: true });
    await expect(cta).toBeVisible();
    if (width < 768) {
      const actions = await page.locator("[data-hero-actions]").boundingBox();
      const figure = await page.locator("[data-portrait-figure]").boundingBox();
      expect(figure!.y).toBeGreaterThan(actions!.y + actions!.height + 8);
    }
    await cta.click();
    await expect(page).toHaveURL(/\/#world$/);
    const link = page
      .getByRole("navigation", { name: "兴趣地图" })
      .getByRole("link", { name: "前往相册", exact: true });
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL("/gallery");
  });
}

test("白与绯红主题跟随深色偏好，前台主题不会渗入后台", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  const before = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(before).toBe("rgb(246, 247, 249)");
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
    ),
  ).toBe("#b42f3c");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor))
    .not.toBe(before);
  await expect(page.getByRole("link", { name: "探索我的世界", exact: true })).toBeVisible();
  for (const path of ["/music", "/blog", "/gallery"]) {
    await page.goto(path);
    expect(
      await page.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
      ),
    ).toBe("#ed5260");
  }
  await page.goto("/dash/login");
  await expect(page.locator(".sao-site")).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--primary").trim(),
    ),
  ).not.toBe("#ed5260");
  await expect(page.getByRole("button", { name: "登录", exact: true })).toBeVisible();
});
