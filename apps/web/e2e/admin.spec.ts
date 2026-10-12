import sharp from "sharp";
import { ADMIN, ADMIN_STATE, cardOf, expect, test } from "./fixtures";

test("登录 → 仪表盘 → 退出", async ({ page }) => {
  await page.goto("/dash/login");
  await page.locator('input[type="email"]').fill(ADMIN.email);
  await page.locator('input[type="password"]').fill(ADMIN.password);
  await page.getByRole("button", { name: "登录" }).click();
  await expect(page.getByRole("heading", { name: "仪表盘" })).toBeVisible();

  await page.getByText("退出登录").click();
  await expect(page).toHaveURL(/\/dash\/login$/);
  await page.goto("/dash");
  await expect(page).toHaveURL(/\/dash\/login$/);
});

test.describe("后台（已登录）", () => {
  test.use({ storageState: ADMIN_STATE });

  test("上传照片 → 相册页用缩略图（WebP）展示，原图可下载", async ({ page, request }) => {
    const png = await sharp({
      create: { width: 1600, height: 1200, channels: 3, background: "#ffb6c1" },
    })
      .png()
      .toBuffer();

    await page.goto("/dash/gallery");
    await page.locator("select").first().selectOption({ label: "旅行记录" });
    await page.locator('input[type="file"]').setInputFiles({
      name: "e2e.png",
      mimeType: "image/png",
      buffer: png,
    });
    await expect(page.getByText("上传完成：1/1 张")).toBeVisible();

    await page.goto("/gallery/旅行记录");
    const img = page.locator('img[srcset*="/api/gallery/files/"]').first();
    await expect(img).toBeVisible();
    // 浏览器按 srcset 挑了缩略图档位并成功加载
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.currentSrc))
      .toMatch(/\/api\/gallery\/files\/[\w-]+\.png\?w=\d+$/);
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);

    const original = new URL((await img.getAttribute("srcset"))!.split(" ")[0]!, page.url());
    original.search = "";
    const thumbRes = await request.get(`${original.pathname}?w=320`);
    expect(thumbRes.headers()["content-type"]).toBe("image/webp");
    expect((await sharp(await thumbRes.body()).metadata()).width).toBe(320);
    expect(thumbRes.headers()["cache-control"]).toContain("immutable");

    const origRes = await request.get(original.pathname);
    expect(origRes.headers()["content-type"]).toBe("image/png");
    expect((await origRes.body()).equals(png)).toBe(true);

    expect((await request.get(`${original.pathname}?w=123`)).status()).toBe(400);
  });

  test("后台新建条目 → 前台可见", async ({ page }) => {
    const title = `e2e 新歌 ${Date.now()}`;
    await page.goto("/dash/music");
    await page.getByRole("button", { name: /新建/ }).click();
    await page.locator("input").first().fill(title);
    await page.getByRole("button", { name: "创建" }).click();
    await expect(page.getByText(title).first()).toBeVisible();

    await page.goto("/music");
    await expect(page.getByText(title)).toBeVisible();
  });

  test("评论：发表 → 删除", async ({ page }) => {
    const msg = `e2e 评论 ${Date.now()}`;
    await page.goto("/blog/hello-world");
    await page.locator("textarea").fill(msg);
    await page.getByRole("button", { name: "发送" }).click();
    await expect(page.getByText(msg)).toBeVisible();
    await expect(page.locator("textarea")).toHaveValue("");

    await cardOf(page.getByText(msg), "删除评论").getByLabel("删除评论").click();
    await expect(page.getByText(msg)).toHaveCount(0);
  });

  test("友链审核通过后出现在友链页", async ({ page }) => {
    const run = Date.now();
    const name = `e2e 待审 ${run}`;
    await page.goto("/friends");
    await page.getByText("我要申请").click();
    await page.getByPlaceholder("站点名称 *").fill(name);
    await page.getByPlaceholder("站点链接 * https://…").fill(`https://pending-${run}.example.org`);
    await page.getByRole("button", { name: "提交申请" }).click();
    await expect(page.getByText(/^已提交/)).toBeVisible();

    await page.goto("/dash/friends");
    await cardOf(page.getByText(name), "通过").getByRole("button", { name: "通过" }).click();
    await expect(page.getByText(/已通过「/)).toBeVisible();

    await page.goto("/friends");
    await expect(page.getByText(name)).toBeVisible();
  });
});
