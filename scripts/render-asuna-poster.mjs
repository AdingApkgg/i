#!/usr/bin/env bun
/** 从仓库现有的亚丝娜模型生成透明静帧；只允许访问本地测试服务。 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const requireWeb = createRequire(new URL("../apps/web/package.json", import.meta.url));
const { chromium } = requireWeb("@playwright/test");
const sharp = requireWeb("sharp");
const base = new URL(process.argv[2] || "http://127.0.0.1:13226");
if (!["localhost", "127.0.0.1", "[::1]"].includes(base.hostname)) {
  throw new Error("静帧工具只允许连接回环地址，不允许连接生产站点");
}
const build = await Bun.build({
  entrypoints: [fileURLToPath(new URL("../apps/web/src/lib/live2d/cubism2.ts", import.meta.url))],
  target: "browser",
});
if (!build.success) throw new Error(`引擎编译失败：${build.logs.join("\n")}`);
const engineJs = await build.outputs[0].text();
const browser = await chromium.launch({
  executablePath: process.argv[3] || undefined,
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
  ],
});
try {
  const page = await browser.newPage();
  // 截图工具的页面由 Playwright 提供，只从本地服务读取已存在的模型文件。
  await page.route(new URL("/__asuna-poster", base).href, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html lang='zh-CN'><body></body></html>",
    }),
  );
  await page.route(new URL("/__asuna-poster-engine.js", base).href, (route) =>
    route.fulfill({ contentType: "application/javascript", body: engineJs }),
  );
  await page.goto(new URL("/__asuna-poster", base).href);
  const png = await page.evaluate(async () => {
    const moduleUrl = "/__asuna-poster-engine.js";
    const { Cubism2Mascot } = await import(moduleUrl);
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 2600;
    document.body.append(canvas);
    const engine = new Cubism2Mascot(canvas);
    await engine.load("/live2d/asuna/asuna_01/index.json");
    // 此处只用于离线拍照：关闭随机动作，固定温和微笑，不修改运行时实现。
    engine.settings.motions = {};
    engine.model.setParamFloat("PARAM_MOUTH_FORM", 0.85);
    engine.model.saveParam();
    const url = await engine.takePhoto();
    engine.destroy();
    return url;
  });
  if (!png.startsWith("data:image/png;base64,")) throw new Error("静帧生成失败");
  const output = fileURLToPath(
    new URL("../apps/web/public/images/asuna-aincrad.webp", import.meta.url),
  );
  await Bun.write(
    output,
    await sharp(Buffer.from(png.split(",")[1], "base64"))
      .trim()
      .resize({ height: 2000 })
      .webp({ quality: 88 })
      .toBuffer(),
  );
  console.log(`已生成亚丝娜静帧：${output}`);
} finally {
  await browser.close();
}
