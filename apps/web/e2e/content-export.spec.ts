import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { ADMIN_STATE, expect, test } from "./fixtures";

test("匿名用户不能下载正文备份", async ({ request }) => {
  const response = await request.get("/api/content-export/backup.json");
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toBe("private, no-store, no-transform");
});

test.describe("正文导出（管理员）", () => {
  test.use({ storageState: ADMIN_STATE });

  test("备份按钮在脚本未就绪时禁用，水合后可正常下载", async ({ page }) => {
    let releaseScripts!: () => void;
    const scripts = new Promise<void>((resolve) => {
      releaseScripts = resolve;
    });
    await page.route(
      (url) => url.pathname.startsWith("/assets/") && url.pathname.endsWith(".js"),
      async (route) => {
        await scripts;
        await route.continue();
      },
    );
    try {
      // 故意延迟真实客户端脚本，检查 SSR 控件不会接受注定丢失的点击。
      await page.goto("/dash/blog", { waitUntil: "commit" });
      const backup = page.getByRole("button", { name: "全部正文备份（JSON）", exact: true });
      await expect(backup).toBeVisible();
      await expect(backup).toBeDisabled();
      releaseScripts();
      await expect(backup).toBeEnabled();
      const [download] = await Promise.all([page.waitForEvent("download"), backup.click()]);
      const data = JSON.parse(await readFile((await download.path())!, "utf8"));
      expect(data.posts).toBeInstanceOf(Array);
      expect(data.pages).toBeInstanceOf(Array);
    } finally {
      releaseScripts();
      await page.unrouteAll({ behavior: "wait" });
    }
  });

  test("单篇 JSON、全量备份和离线 HTML 都保留已保存的草稿", async ({ page, browser }, testInfo) => {
    const slug = `export-${Date.now()}`;
    await page.goto("/dash/blog/new");
    // 先等懒加载编辑器就绪，避免在 hydration 前输入被初始状态覆盖。
    await expect(page.locator(".ProseMirror")).toBeVisible();
    await page.getByPlaceholder("标题", { exact: true }).fill("导出测试文章");
    await page.getByLabel(/Slug/).fill(slug);
    await page.locator(".ProseMirror").click();
    await page.keyboard.insertText("需要保留的正文");
    await page.keyboard.press("ControlOrMeta+B");
    await page.keyboard.insertText("加粗内容");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page).toHaveURL(/\/dash\/blog\/(?!new)/);
    await page.setViewportSize({ width: 390, height: 844 });
    const exportButton = await page
      .getByRole("button", { name: "导出", exact: true })
      .boundingBox();
    expect(exportButton).not.toBeNull();
    expect(exportButton!.x).toBeGreaterThanOrEqual(0);
    expect(exportButton!.x + exportButton!.width).toBeLessThanOrEqual(390);

    const downloadMenu = async (label: string) => {
      await page.getByRole("button", { name: "导出", exact: true }).click();
      const pending = page.waitForEvent("download");
      await page.getByRole("menuitem", { name: label, exact: true }).click();
      return pending;
    };
    const json = await downloadMenu("JSON 备份");
    expect(json.suggestedFilename()).toBe(`post-${slug}.json`);
    const data = JSON.parse(await readFile((await json.path())!, "utf8"));
    expect(data.posts).toHaveLength(1);
    expect(data.posts[0]).toMatchObject({
      title: "导出测试文章",
      slug,
      status: "draft",
      content: { type: "doc" },
    });
    expect(JSON.stringify(data.posts[0].content)).toContain("加粗内容");
    await page.setViewportSize({ width: 1440, height: 1000 });

    const html = await downloadMenu("HTML 导出");
    expect(html.suggestedFilename()).toBe(`post-${slug}.html`);
    const htmlPath = testInfo.outputPath("article.html");
    await html.saveAs(htmlPath);
    // 关闭 JavaScript 和网络后打开下载文件，正文和加粗仍须可读。
    const offline = await browser.newContext({ javaScriptEnabled: false, offline: true });
    try {
      const document = await offline.newPage();
      await document.goto(pathToFileURL(htmlPath).href);
      await expect(document.getByRole("heading", { name: "导出测试文章" })).toBeVisible();
      await expect(document.locator("article strong")).toHaveText("加粗内容");
    } finally {
      await offline.close();
    }

    await page.getByPlaceholder("标题", { exact: true }).fill("尚未保存的标题");
    await expect(page.getByRole("button", { name: "导出", exact: true })).toBeDisabled();
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByRole("button", { name: "导出", exact: true })).toBeEnabled();
    await page.goto("/dash/blog");
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "全部正文备份（JSON）", exact: true }).click();
    const backup = await pending;
    const all = JSON.parse(await readFile((await backup.path())!, "utf8"));
    expect(all.posts.find((p: { slug: string }) => p.slug === slug)).toMatchObject({
      title: "尚未保存的标题",
      status: "draft",
    });
    expect(all.pages).toBeInstanceOf(Array);
    const row = page.locator("li").filter({ hasText: `/${slug}` });
    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "删除", exact: true }).click();
    await expect(row).toHaveCount(0);
  });
});
