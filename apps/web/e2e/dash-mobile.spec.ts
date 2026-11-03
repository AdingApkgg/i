import sharp from "sharp";
import { ADMIN_STATE, expect, test } from "./fixtures";

/** 上传一张小图，保证媒体库里有卡片可勾选 */
async function uploadOne(request: import("@playwright/test").APIRequestContext) {
  const buffer = await sharp({
    create: { width: 48, height: 48, channels: 3, background: "#cdb4db" },
  })
    .png()
    .toBuffer();
  const res = await request.post("/api/gallery/upload", {
    multipart: { file: { name: "dash-mobile.png", mimeType: "image/png", buffer } },
  });
  expect(res.ok()).toBe(true);
  const { imageUrl } = (await res.json()) as { imageUrl: string };
  return imageUrl.split("/").pop()!;
}

/** 后台在窄屏下把侧栏收进抽屉：能开、能跳、跳完自动收 */
test.describe("后台移动端导航", () => {
  test.use({ storageState: ADMIN_STATE, viewport: { width: 390, height: 844 } });

  test("抽屉开合与跳转后自动收起，正文不再被侧栏挤压", async ({ page }) => {
    await page.goto("/dash");
    const drawer = page.locator("#dash-nav");
    await expect(drawer).toBeHidden();

    const trigger = page.getByRole("button", { name: "打开后台导航" });
    await expect(trigger).toBeVisible();
    // 44px 左右的触控区
    const box = await trigger.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);

    await trigger.click();
    await expect(drawer).toBeVisible();
    await expect(page.getByRole("button", { name: "关闭导航" }).first()).toBeVisible();
    // 导航项要够高才好点
    const item = drawer.locator("nav a").first();
    expect((await item.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(40);

    await drawer.getByRole("link", { name: /媒体库/ }).click();
    await page.waitForURL(/\/dash\/media$/);
    await expect(drawer).toBeHidden();
  });

  test("仪表盘用图表展示各域条目与新增趋势，窄屏不横向溢出", async ({ page }) => {
    await page.goto("/dash");
    const charts = page.locator("main figure");
    await expect(charts).toHaveCount(2);
    for (const chart of await charts.all()) {
      await expect(chart.locator("svg").first()).toBeVisible();
    }
    // 条形图上要有域名的刻度文字
    await expect(charts.first().locator("text").first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test("媒体库统计面板用饼图与体积分布展示占用", async ({ page, request }) => {
    await uploadOne(request);
    await page.goto("/dash/media");
    await page.getByRole("button", { name: "展开占用统计" }).click();
    const charts = page.locator("main figure");
    await expect(charts).toHaveCount(2);
    await expect(charts.first().locator("svg").first()).toBeVisible();
    await expect(page.locator("main").getByText("体积分布")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });

  test("窄屏列表用卡片代替横向表格，行内按钮可点", async ({ page }) => {
    await page.goto("/dash/music");
    const firstRow = page.locator("main ul li").first();
    if (await firstRow.count()) {
      // 表格在窄屏隐藏，卡片可见
      await expect(page.locator("main table")).toBeHidden();
      await expect(firstRow).toBeVisible();
      const edit = firstRow.getByRole("button", { name: "编辑" });
      expect((await edit.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(40);
    }

    // 正常宽度下回到表格
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(page.locator("main ul li").first()).toBeHidden();
  });

  test("相册网格的编辑按钮在触屏上常显且够大", async ({ page, request }) => {
    await uploadOne(request);
    await page.goto("/dash/gallery");
    const edit = page.locator("main button[aria-label=编辑]").first();
    if (await edit.count()) {
      await expect(edit).toBeVisible();
      const box = await edit.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(36);
    }
  });

  test("媒体库选中后底部操作条固定在视口底部", async ({ page, request }) => {
    const key = await uploadOne(request);
    await page.goto("/dash/media");
    const first = page.locator("main li", { hasText: key });
    await expect(first).toBeVisible();

    await first.locator("input[type=checkbox]").check();
    const bar = page.locator("main").getByText(/^已选 1$/);
    await expect(bar).toBeVisible();

    const barBox = await bar.boundingBox();
    const viewport = page.viewportSize()!;
    // 贴着视口底部：剩余间距不超过 60px（安全区 + 内边距）
    expect(viewport.height - (barBox!.y + barBox!.height)).toBeLessThanOrEqual(60);
  });
});
