import { expect, test } from "./fixtures";

const groups = [
  {
    label: "日常",
    entries: [
      ["博客", "/blog"],
      ["相册", "/gallery"],
      ["说说", "/moments"],
      ["自慰记录", "/masturbation"],
    ],
  },
  {
    label: "收藏",
    entries: [
      ["音乐", "/music"],
      ["番剧", "/anime"],
      ["影视", "/movie"],
      ["视觉小说", "/vn"],
    ],
  },
  {
    label: "兴趣",
    entries: [
      ["舞萌", "/maimai"],
      ["东方", "/touhou"],
      ["设备", "/device"],
    ],
  },
] as const;

// 删除任何栏目、失去原链接，或切换组时旧组仍展开，都应被真实界面行为捕获。
test("桌面分组可切换，十二个栏目仍可逐一访问", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "主导航" });
  await expect(nav.getByRole("link", { name: "音乐", exact: true })).not.toBeVisible();
  for (const group of groups) {
    await nav.locator("summary").filter({ hasText: group.label }).click();
    for (const [label, href] of group.entries) {
      const link = nav.getByRole("link", { name: label, exact: true });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", href);
    }
    await expect(nav.locator("details[open]")).toHaveCount(1);
  }
  await expect(nav.getByRole("link", { name: "友链", exact: true })).toHaveAttribute(
    "href",
    "/friends",
  );
});

test("直达深层页面自动展开所属组，键盘切页保留客户端上下文", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/blog/hello-world");
  const nav = page.getByRole("navigation", { name: "主导航" });
  await expect(nav.getByRole("link", { name: "博客", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.evaluate(() => {
    (window as unknown as { previewMarker: number }).previewMarker = 42;
  });
  await nav.locator("summary").filter({ hasText: "收藏" }).focus();
  await page.keyboard.press("Enter");
  const music = nav.getByRole("link", { name: "音乐", exact: true });
  await music.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/music");
  await expect(music).toHaveAttribute("aria-current", "page");
  expect(
    await page.evaluate(() => (window as unknown as { previewMarker?: number }).previewMarker),
  ).toBe(42);
  await page.goBack();
  await expect(nav.getByRole("link", { name: "博客", exact: true })).toBeVisible();
});

test("手机面板保留全部分组，焦点受控且关闭后回到实际触发按钮", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "主导航" });
  const trigger = nav.getByRole("button", { name: "收藏", exact: true });
  await trigger.click();
  const panel = page.getByRole("dialog", { name: "收藏", exact: true });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("link", { name: "音乐", exact: true })).toBeVisible();
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    expect(await panel.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await page.getByRole("dialog").getByRole("button", { name: "日常", exact: true }).click();
  for (const [label, href] of groups[0]!.entries)
    await expect(
      page.getByRole("dialog").getByRole("link", { name: label, exact: true }),
    ).toHaveAttribute("href", href);
  await page.getByRole("dialog").getByRole("link", { name: "博客", exact: true }).click();
  await expect(page).toHaveURL("/blog");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await nav.getByRole("button", { name: "兴趣", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => getComputedStyle(document.body).pointerEvents)).not.toBe("none");
});

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`分组导航与正文在 ${width}px 不发生横向溢出`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "主导航" });
    if (width < 1024) await nav.getByRole("button", { name: "收藏", exact: true }).click();
    else await nav.locator("summary").filter({ hasText: "收藏" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    if (width >= 1024)
      expect((await page.locator("header").boundingBox())!.width).toBeLessThanOrEqual(192);
    else
      await expect(
        page.getByRole("dialog").getByRole("link", { name: "音乐", exact: true }),
      ).toBeInViewport();
  });
}

test("禁用 JavaScript 后仍能展开桌面菜单或使用手机全部栏目导航", async ({ browser, baseURL }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  try {
    await page.route(
      (u) => u.origin !== new URL(baseURL!).origin,
      (r) => r.abort(),
    );
    await page.goto(baseURL!);
    const nav = page.getByRole("navigation", { name: "全部栏目" });
    await nav.getByRole("link", { name: "设备", exact: true }).click();
    await expect(page).toHaveURL(`${baseURL}/device`);
    const home = nav.getByRole("link", { name: "首页", exact: true });
    await expect(home).toBeVisible();
    await home.click();
    await expect(page).toHaveURL(`${baseURL}/`);
    await expect(nav.getByRole("link")).toHaveCount(13);
    await page.setViewportSize({ width: 1440, height: 900 });
    const desktop = page.getByRole("navigation", { name: "主导航" });
    await desktop.locator("summary").filter({ hasText: "收藏" }).click();
    await desktop.getByRole("link", { name: "音乐", exact: true }).click();
    await expect(page).toHaveURL(`${baseURL}/music`);
  } finally {
    await context.close();
  }
});
