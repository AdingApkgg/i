import sharp from "sharp";
import { ADMIN_STATE, expect, test } from "./fixtures";

test.describe("VNDB、翻译配置与设备", () => {
  test.use({ storageState: ADMIN_STATE });

  test("AI 配置可保存、保留和清除密钥，页面不回显", async ({ page }) => {
    await page.goto("/dash/settings");
    const config = page
      .locator("form")
      .filter({ has: page.getByRole("button", { name: "保存翻译配置" }) });
    await config.getByLabel("接口 Base URL").fill("https://ai.example/v1");
    await config.getByLabel("模型", { exact: true }).fill("test-model");
    await config.getByLabel(/API 密钥/).fill("e2e-private-provider-key");
    await config.getByLabel("启用 AI 翻译").check();
    await config.getByRole("button", { name: "保存翻译配置" }).click();
    await expect(page.getByText("AI 翻译配置已保存")).toBeVisible();
    await expect(config.getByLabel(/API 密钥/)).toHaveValue("");
    await page.reload();
    await expect(config.getByText("API 密钥 · 已配置")).toBeVisible();
    await expect(config.getByLabel(/API 密钥/)).toHaveValue("");
    await config.getByLabel("模型", { exact: true }).fill("updated-model");
    await config.getByRole("button", { name: "保存翻译配置" }).click();
    await expect(config.getByText("API 密钥 · 已配置")).toBeVisible();
    await config.getByLabel("清除已保存密钥").check();
    await config.getByRole("button", { name: "保存翻译配置" }).click();
    await expect(config.getByText("API 密钥 · 未配置")).toBeVisible();
    await expect(config.getByLabel("启用 AI 翻译")).not.toBeChecked();
    await config.getByLabel("接口 Base URL").fill("");
    await config.getByLabel("模型", { exact: true }).fill("");
    await config.getByRole("button", { name: "保存翻译配置" }).click();
    await expect(config.getByLabel("接口 Base URL")).toHaveValue("");
  });

  test("VNDB 选择预览、翻译确认、保存；保留个人记录", async ({ page }) => {
    const title = `e2e VN ${Date.now()}`;
    const candidate = {
      vndbId: "v99999999",
      title,
      originalTitle: "Original novel",
      brand: "Key",
      released: "2004-04-28",
      coverUrl: "",
      vndbRating: 8.64,
      descriptionOriginal: "Original description",
      link: "https://vndb.org/v99999999",
    };
    await page.route("**/api/rpc/vndb/search*", (r) =>
      r.fulfill({
        json: {
          json: [
            candidate,
            {
              ...candidate,
              vndbId: "v99999998",
              title: "Different novel",
              descriptionOriginal: "Different original",
            },
          ],
        },
      }),
    );
    await page.route("**/api/rpc/translation/settings*", (r) =>
      r.fulfill({
        json: {
          json: { baseUrl: "https://ai.example/v1", model: "test", enabled: true, hasKey: true },
        },
      }),
    );
    await page.route("**/api/rpc/translation/preview*", (r) =>
      r.fulfill({ json: { json: { text: "已确认中文简介", model: "test" } } }),
    );
    await page.goto("/dash/vn");
    await page.getByRole("button", { name: /新建/ }).click();
    await page.getByLabel("标题").fill(title);
    await page.getByLabel("状态").selectOption("通关");
    await page.getByLabel("评分", { exact: true }).fill("10");
    await page.getByLabel("游玩时长(h)").fill("50");
    await page.getByLabel("备注").fill("个人记录保留");
    await page.getByRole("button", { name: "创建", exact: true }).click();
    const row = page.getByRole("row").filter({ hasText: title });
    await row.getByRole("button", { name: "编辑" }).click();
    await page.getByRole("button", { name: "搜索 VNDB", exact: true }).click();
    await page.getByRole("button", { name: new RegExp(`${title}.*v99999999`) }).click();
    await expect(page.getByRole("group", { name: "VNDB 资料预览" })).toContainText(
      "Original description",
    );
    await expect(page.getByLabel("VNDB ID", { exact: true })).toHaveValue("");
    await page.getByRole("button", { name: "确认填入草稿" }).click();
    await expect(page.getByLabel("评分", { exact: true })).toHaveValue("10");
    await expect(page.getByLabel("状态")).toHaveValue("通关");
    await expect(page.getByLabel("游玩时长(h)")).toHaveValue("50");
    await expect(page.getByLabel("备注")).toHaveValue("个人记录保留");
    await page.getByRole("button", { name: "预览 AI 简介翻译" }).click();
    await expect(page.getByRole("group", { name: "AI 翻译预览" })).toContainText("已确认中文简介");
    await expect(page.getByLabel("中文简介")).toHaveValue("");
    await page.getByRole("button", { name: "采用译文" }).click();
    await page.getByRole("button", { name: "保存修改" }).click();
    await expect(row).toBeVisible();
    await page.goto("/vn");
    const card = page
      .locator("div")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
      .filter({ hasText: "已确认中文简介" })
      .last();
    await expect(card).toContainText("我的评分 10/10");
    await expect(card).toContainText("VNDB 评分：8.64/10");
    await card.getByText("简介原文", { exact: true }).click();
    await expect(card.getByText("Original description", { exact: true })).toBeVisible();
    await page.goto("/dash/vn");
    await page
      .getByRole("row")
      .filter({ hasText: title })
      .getByRole("button", { name: "编辑" })
      .click();
    await page.getByRole("button", { name: "搜索 VNDB", exact: true }).click();
    await page.getByRole("button", { name: /Different novel.*v99999998/ }).click();
    await page.getByRole("button", { name: "确认填入草稿" }).click();
    await expect(page.getByLabel("中文简介")).toHaveValue("");
    await page.getByRole("button", { name: "取消", exact: true }).click();
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("row")
      .filter({ hasText: title })
      .getByRole("button", { name: "删除" })
      .click();
    await expect(page.getByRole("row").filter({ hasText: title })).toHaveCount(0);
  });

  test("设备图片上传后能保存并在前台加载", async ({ page, request }) => {
    const name = `e2e 上传设备 ${Date.now()}`;
    const png = await sharp({
      create: { width: 64, height: 64, channels: 3, background: "#efb4c2" },
    })
      .png()
      .toBuffer();
    await page.goto("/dash/device");
    await page.getByRole("button", { name: /新建/ }).click();
    await page.getByLabel("名称").fill(name);
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "device.png", mimeType: "image/png", buffer: png });
    await expect(page.getByText("上传成功 ✿", { exact: true })).toBeVisible();
    const imageUrl = await page.getByPlaceholder("https://… 或上传图片").inputValue();
    await page.getByRole("button", { name: "创建", exact: true }).click();
    await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
    await page.goto("/device");
    const image = page.getByRole("img", { name, exact: true });
    await expect
      .poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
    await page.goto("/dash/device");
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("row")
      .filter({ hasText: name })
      .getByRole("button", { name: "删除" })
      .click();
    await expect(page.getByRole("row").filter({ hasText: name })).toHaveCount(0);
    const key = imageUrl.split("/").pop()!;
    expect((await request.delete(`/api/gallery/upload?key=${encodeURIComponent(key)}`)).ok()).toBe(
      true,
    );
  });

  test("设备编辑支持图片、多行规格、自由日期和备注；小屏无溢出", async ({ page }) => {
    const name = `e2e 设备 ${Date.now()}`;
    await page.goto("/dash/device");
    await page.getByRole("button", { name: /新建/ }).click();
    await page.getByLabel("名称").fill(name);
    await expect(page.getByRole("button", { name: "上传图片" })).toBeVisible();
    await page.getByPlaceholder("https://… 或上传图片").fill("https://example.com/device.png");
    await page.getByLabel("规格").fill("CPU: test\nRAM: 32G");
    await page.getByLabel("入手日期").fill("2024 年春天");
    await page.getByLabel("备注").fill("随身设备备注");
    await page.getByRole("button", { name: "创建", exact: true }).click();
    await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/device");
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await expect(page.getByText("CPU: test\nRAM: 32G", { exact: true })).toBeVisible();
    await expect(page.getByText("入手：2024 年春天")).toBeVisible();
    await expect(page.getByText("随身设备备注")).toBeVisible();
    await expect(page.getByRole("img", { name, exact: true })).toHaveAttribute("src", /device.png/);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.goto("/dash/device");
    page.once("dialog", (d) => d.accept());
    await page
      .getByRole("row")
      .filter({ hasText: name })
      .getByRole("button", { name: "删除" })
      .click();
  });
});
