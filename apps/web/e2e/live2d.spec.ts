import { readFile } from "node:fs/promises";
import { expect, test } from "./fixtures";

// 捕捉模型目录仍走 CDN、资源未被打进生产产物以及换装丢资源的回归。
test("模型目录与换装资源由本站提供，保留旧偏好索引", async ({ request }) => {
  const response = await request.get("/live2d/model_list.json");
  expect(response.status()).toBe(200);
  const catalog = await response.json();
  expect(catalog.models).toHaveLength(11);
  expect(catalog.models[0]).toHaveLength(42);
  expect(catalog.models[0].slice(0, 2)).toEqual(["asuna/asuna_02", "asuna/asuna_01"]);

  for (const model of ["asuna/asuna_02", "asuna/asuna_01", "bilibili-live/22"]) {
    const url = `/live2d/model/${model}/index.json`;
    const entry = await request.get(url);
    expect(entry.status(), url).toBe(200);
    const settings = await entry.json();
    for (const asset of [settings.model, ...settings.textures, settings.physics].filter(Boolean)) {
      const target = new URL(asset, entry.url()).pathname;
      const resource = await request.get(target);
      expect(resource.status(), target).toBe(200);
      expect((await resource.body()).length, target).toBeGreaterThan(0);
    }
  }
});

test.describe("仓内 Live2D 浏览器运行", () => {
  test.use({ showMascot: true });

  test("拦截站外请求仍能绘制、换装、换人、拍照和重新召唤", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "i.mascot",
        JSON.stringify({
          state: { hidden: false, group: 0, costume: 1 },
          version: 0,
        }),
      );
    });
    const npmRequests: string[] = [];
    let coreRequests = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/live2d/core/live2d.min.js") coreRequests++;
      if (/weblive2d|registry\.|unpkg\.com|cdn\.jsdelivr\.net/.test(request.url())) {
        npmRequests.push(request.url());
      }
    });
    // 刻意延迟换人的贴图十二帧，覆盖动作淡入后旧循环抢先绘制半成品的窗口。
    await page.route("**/live2d/model/sagiri/**/*.png", async (route) => {
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            let remaining = 12;
            const frame = () => {
              if (--remaining === 0) resolve();
              else requestAnimationFrame(frame);
            };
            requestAnimationFrame(frame);
          }),
      );
      await route.continue();
    });
    await page.goto("/");
    const canvas = page.locator("#waifu-canvas");
    await expect(canvas).toBeVisible();
    await expect(page.locator('script[src="/live2d/core/live2d.min.js"]')).toHaveCount(1);

    // 实际点击拍照，读取渲染器同帧导出的 PNG，不能只用“canvas 存在”冒充画出了人物。
    const expectPaintedPhoto = async () => {
      // 已确认改为显式工具入口；保留下面所有真实绘制、换装、换人和召回断言。
      const trigger = page.getByRole("button", { name: "看板娘工具与互动", exact: true });
      if ((await trigger.getAttribute("aria-expanded")) !== "true") await trigger.click();
      await expect(
        page.getByRole("dialog", { name: "看板娘工具与互动", exact: true }),
      ).toBeVisible();
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.locator("#waifu-tool-photo").click(),
      ]);
      const file = await download.path();
      expect(file).not.toBeNull();
      const png = await readFile(file!);
      const coverage = await page.evaluate(async (base64) => {
        const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
        const image = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
        const frame = new OffscreenCanvas(image.width, image.height);
        const context = frame.getContext("2d")!;
        context.drawImage(image, 0, 0);
        const data = context.getImageData(0, 0, image.width, image.height).data;
        let opaque = 0;
        for (let i = 3; i < data.length; i += 4) if (data[i]! > 0) opaque++;
        image.close();
        return opaque / (data.length / 4);
      }, png.toString("base64"));
      expect(coverage).toBeGreaterThan(0.03);
    };
    await expectPaintedPhoto();

    // 先重挂再热切换，覆盖非零 Core 槽位，而不仅在默认 0 号槽位换装。
    await page.locator("#waifu-tool-quit").click();
    await expect(canvas).toHaveCount(0);
    await page.getByTitle("召唤看板娘", { exact: true }).click();
    await expect(canvas).toBeVisible();
    await expectPaintedPhoto();

    await page.locator("#waifu-tool-switch-texture").click();
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("i.mascot")!).state.costume))
      .toBe(2);
    await expectPaintedPhoto();
    await page.locator("#waifu-tool-switch-model").click();
    await expect
      .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("i.mascot")!).state.group))
      .toBe(1);
    await expectPaintedPhoto();

    await page.locator("#waifu-tool-quit").click();
    await expect(canvas).toHaveCount(0);
    await page.getByTitle("召唤看板娘", { exact: true }).click();
    await expect(canvas).toBeVisible();
    await expectPaintedPhoto();
    await expect(page.locator('script[src="/live2d/core/live2d.min.js"]')).toHaveCount(1);
    expect(coreRequests).toBe(1);
    expect(npmRequests).toEqual([]);
  });
});
