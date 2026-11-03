import sharp from "sharp";
import { ADMIN_STATE, expect, test } from "./fixtures";

const png = (color: string) =>
  sharp({ create: { width: 64, height: 48, channels: 3, background: color } })
    .png()
    .toBuffer();

/** 走接口上传，拿到 key（CAS 用内容哈希，卡片上显示的是它而不是原文件名） */
async function upload(
  request: import("@playwright/test").APIRequestContext,
  name: string,
  buffer: Buffer,
) {
  const res = await request.post("/api/gallery/upload", {
    multipart: { file: { name, mimeType: "image/png", buffer } },
  });
  expect(res.ok()).toBe(true);
  const { imageUrl } = (await res.json()) as { imageUrl: string };
  return imageUrl.split("/").pop()!;
}

test.describe("媒体库", () => {
  test.use({ storageState: ADMIN_STATE });

  test("孤儿页点开写明无人引用 → 勾选删掉一张，另一张留下", async ({ page, request }) => {
    const a = await upload(request, "media-a.png", await png("#ff9aa2"));
    const b = await upload(request, "media-b.png", await png("#a2d2ff"));

    await page.goto("/dash/media/orphans");
    await expect(page.locator("main li", { hasText: a })).toBeVisible();
    await expect(page.locator("main li", { hasText: b })).toBeVisible();

    await page.locator("main li", { hasText: a }).locator("button").first().click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog.getByText("无人引用")).toBeVisible();
    await dialog.getByRole("button", { name: "关闭" }).click();

    await page.locator("main li", { hasText: a }).locator("input[type=checkbox]").check();
    await page.getByRole("button", { name: /删除选中/ }).click();
    await expect(page.getByText("已删除 1 个文件")).toBeVisible();
    await expect(page.locator("main li", { hasText: a })).toHaveCount(0);
    await expect(page.locator("main li", { hasText: b })).toBeVisible();
  });

  test("后台上传按钮可用，类型筛选与关键字搜索收窄列表", async ({ page }) => {
    await page.goto("/dash/media");
    await page.locator('input[type="file"]').setInputFiles({
      name: "media-up.png",
      mimeType: "image/png",
      buffer: await png("#caffbf"),
    });
    await expect(page.getByText("已上传 1 个文件 ✿")).toBeVisible();

    await page.locator("select").first().selectOption({ label: "音频" });
    await expect(page.getByText("没有匹配的文件")).toBeVisible();

    await page.locator("select").first().selectOption({ label: "图片" });
    await page.locator('input[placeholder="搜索文件名…"]').fill(".png");
    await expect(page.locator("main li img").first()).toBeVisible();
    await page.locator('input[placeholder="搜索文件名…"]').fill("不存在的文件");
    await expect(page.getByText("没有匹配的文件")).toBeVisible();
  });
});
