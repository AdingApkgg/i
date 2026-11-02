import { chromium } from "@playwright/test";

const BASE = process.env.BASE ?? "http://127.0.0.1:8399";
const browser = await chromium.launch();
const report = {};

for (const [name, viewport, scheme] of [
  ["desktop", { width: 1440, height: 900 }, "light"],
  ["mobile", { width: 390, height: 844 }, "light"],
  ["dark", { width: 1440, height: 900 }, "dark"],
]) {
  const ctx = await browser.newContext({ viewport, colorScheme: scheme, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const logs = [];
  page.on("console", (m) =>
    m.type() === "error" || m.type() === "warning" ? logs.push(`${m.type()}: ${m.text()}`) : null,
  );
  page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
  const res = await page.goto(`${BASE}/about`, { waitUntil: "load" });
  await page.waitForTimeout(1500);
  const spoilers = page.getByRole("button", { name: /点此显示/ });
  const count = await spoilers.count();
  if (count) {
    await spoilers.first().click();
    await page.waitForTimeout(400);
  }
  const revealed = await page.getByRole("button", { name: /合法萝莉/ }).count();
  const img = await page
    .locator("main img, article img")
    .first()
    .evaluate((el) => el.currentSrc || el.src)
    .catch(() => "none");
  await page.screenshot({ path: `/home/i/about-${name}-20261102.png`, fullPage: false });
  report[name] = {
    status: res?.status(),
    spoilers: count,
    revealed,
    img,
    title: await page.title(),
    logs: logs.slice(0, 8),
  };
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(report, null, 2));
