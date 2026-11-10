import { readFile } from "node:fs/promises";
import { expect, test } from "./fixtures";
import { navigateMain } from "./navigation-helpers";

for (const [screen, viewport] of [
  [767, 767],
  [768, 768],
  [767, 1440],
  [768, 390],
] as const) {
  test.describe(`Live2D 门槛 screen=${screen}，viewport=${viewport}`, () => {
    test.use({
      showMascot: true,
      screen: { width: screen, height: 1000 },
      viewport: { width: viewport, height: 1000 },
    });
    test("按设备宽度决定下载，不用页面 800px 断点代替", async ({ page }) => {
      await page.addInitScript(() =>
        localStorage.setItem(
          "i.mascot",
          JSON.stringify({ state: { hidden: false, group: 0, costume: 1 }, version: 0 }),
        ),
      );
      const resources: string[] = [];
      page.on("request", (request) => {
        if (/\/live2d\/(core|model)/.test(new URL(request.url()).pathname))
          resources.push(request.url());
      });
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      expect(await page.evaluate(() => window.screen.width)).toBe(screen);
      expect(await page.evaluate(() => innerWidth)).toBe(viewport);
      if (screen < 768) {
        await expect(page.locator("#waifu-canvas")).toHaveCount(0);
        expect(resources).toEqual([]);
        await navigateMain(page, "作品列表", "作品");
        await expect(page).toHaveURL("/projects");
        await page.waitForLoadState("networkidle");
        expect(resources).toEqual([]);
      } else {
        await expect(page.locator("#waifu-canvas")).toBeVisible();
        expect(resources.filter((url) => url.endsWith("/core/live2d.min.js"))).toHaveLength(1);
        expect(resources.some((url) => url.includes("/model/"))).toBe(true);
      }
    });
  });
}

test.describe("外壳能力连续性", () => {
  test.use({ showMascot: true });
  test("主动播放后跨首页、内页和 404 保留同一音频及模型；菜单位于模型上方", async ({
    page,
    baseURL,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        "i.mascot",
        JSON.stringify({ state: { hidden: false, group: 0, costume: 1 }, version: 0 }),
      ),
    );
    const tone = await readFile(new URL("./media/tone.wav", import.meta.url));
    await page.route("https://api.injahow.cn/meting/**", (route) =>
      route.fulfill({
        json: [
          { name: "隔离验收音轨", artist: "合成测试音", url: "/__home_test/tone.wav", pic: "" },
        ],
      }),
    );
    await page.route("**/__home_test/tone.wav", (route) => {
      const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range ?? "");
      if (range) {
        const start = Number(range[1]),
          end = Math.min(Number(range[2] || tone.length - 1), tone.length - 1);
        return route.fulfill({
          status: 206,
          body: tone.subarray(start, end + 1),
          contentType: "audio/wav",
          headers: {
            "accept-ranges": "bytes",
            "content-range": `bytes ${start}-${end}/${tone.length}`,
          },
        });
      }
      return route.fulfill({
        body: tone,
        contentType: "audio/wav",
        headers: { "accept-ranges": "bytes" },
      });
    });
    let coreReads = 0;
    page.on("request", (request) => {
      if (new URL(request.url()).pathname === "/live2d/core/live2d.min.js") coreReads++;
    });
    await page.goto("/");
    const canvas = page.locator("#waifu-canvas");
    await expect(canvas).toBeVisible();
    const audio = page.locator(".music-player audio");
    await expect(audio).toHaveAttribute("src", /tone.wav/);
    await expect(audio).toHaveJSProperty("paused", true);
    await expect(
      page.locator(".music-player").getByRole("button", { name: "展开音乐播放器" }),
    ).toBeVisible();
    await page.locator(".music-player").getByRole("button", { name: "展开音乐播放器" }).click();
    await page.locator(".music-player").getByRole("button", { name: "播放", exact: true }).click();
    await expect
      .poll(() => audio.evaluate((node: HTMLAudioElement) => node.currentTime))
      .toBeGreaterThan(0.1);
    await audio.evaluate((node) => {
      node.dataset.continuity = "audio";
    });
    await canvas.evaluate((node) => {
      node.dataset.continuity = "mascot";
    });
    await page.setViewportSize({ width: 900, height: 1000 });
    const dock = (await page.locator(".music-player > .fixed").boundingBox())!;
    const sidebar = (await page.locator(".public-sidebar").boundingBox())!;
    expect(dock.x, "窄桌面播放器不得覆盖侧栏").toBeGreaterThanOrEqual(sidebar.x + sidebar.width);
    for (const [label, path] of [
      ["作品列表", "/projects"],
      ["博客", "/blog"],
      ["首页", "/"],
    ] as const) {
      await navigateMain(page, label);
      await expect(page).toHaveURL(path);
      await expect(audio).toHaveAttribute("data-continuity", "audio");
      await expect(audio).toHaveJSProperty("paused", false);
      await expect(canvas).toHaveAttribute("data-continuity", "mascot");
    }
    // 通过浏览器历史导航事件进入未匹配路由，不 reload，也不依赖 Router 私有全局对象。
    await page.evaluate(() => {
      history.pushState(
        { ...history.state, idx: (history.state?.idx ?? 0) + 1, key: "home-404-probe" },
        "",
        "/__home_missing_page",
      );
      dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
    });
    await expect(page.getByRole("heading", { name: "这一页迷路了", exact: true })).toBeVisible();
    await expect(audio).toHaveAttribute("data-continuity", "audio");
    await expect(canvas).toHaveAttribute("data-continuity", "mascot");
    expect(coreReads).toBe(1);
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.getByRole("button", { name: "栏目", exact: true }).click();
    const panel = page.getByRole("dialog", { name: "全部栏目", exact: true });
    await expect(panel).toBeVisible();
    const music = panel.getByRole("link", { name: "音乐", exact: true });
    const box = (await music.boundingBox())!;
    expect(
      await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest("dialog"), {
        x: box.x + box.width / 2,
        y: box.y + box.height / 2,
      }),
    ).toBe(true);
    await music.click();
    await expect(page).toHaveURL(`${baseURL}/music`);
    await expect(canvas).toHaveAttribute("data-continuity", "mascot");
  });
});
