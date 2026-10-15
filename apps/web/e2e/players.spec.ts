import { readFile } from "node:fs/promises";
import type { Route } from "@playwright/test";
import pg from "pg";
import { expect, test } from "./fixtures";

const slug = `e2e-players-${Date.now()}`;
const media = (name: string) => `/__media/${name}`;
const songs = ["第一首", "第二首"].map((name, i) => ({
  name,
  artist: "测试歌手",
  url: media(`tone.wav?track=${i}`),
  pic: "",
}));

test.beforeAll(async () => {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query(
      `INSERT INTO "Post" (id, slug, title, content, status, "updatedAt") VALUES ($1, $1, '播放器验收', $2, 'published', now())`,
      [
        slug,
        {
          type: "doc",
          content: [
            { type: "music", attrs: { server: "netease", type: "playlist", mid: "e2e" } },
            ...["sample.mp4", "stream.m3u8?token=e2e", "missing.mp4"].map((src) => ({
              type: "video",
              attrs: { src: media(src) },
            })),
          ],
        },
      ],
    );
  } finally {
    await db.end();
  }
});

test.afterAll(async () => {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    await db.query('DELETE FROM "Post" WHERE slug = $1', [slug]);
  } finally {
    await db.end();
  }
});

async function fulfillMedia(route: Route, name: string) {
  const body = await readFile(new URL(`./media/${name}`, import.meta.url));
  const contentType = name.endsWith("m3u8")
    ? "application/vnd.apple.mpegurl"
    : name.endsWith("segment")
      ? "video/mp2t"
      : name.endsWith("wav")
        ? "audio/wav"
        : "video/mp4";
  const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range ?? "");
  if (range) {
    const start = Number(range[1]),
      end = Math.min(Number(range[2] || body.length - 1), body.length - 1);
    return route.fulfill({
      status: 206,
      body: body.subarray(start, end + 1),
      contentType,
      headers: {
        "accept-ranges": "bytes",
        "content-range": `bytes ${start}-${end}/${body.length}`,
      },
    });
  }
  return route.fulfill({ body, contentType, headers: { "accept-ranges": "bytes" } });
}

test.beforeEach(async ({ page }) => {
  await page.route("https://api.injahow.cn/meting/**", (route) => route.fulfill({ json: songs }));
  await page.route("**/__media/**", async (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop()!;
    if (name === "missing.mp4") return route.fulfill({ status: 404 });
    return fulfillMedia(route, name);
  });
});

test("音乐：主动选播、进度音量控制、切歌和客户端跨页不中断", async ({ page }, testInfo) => {
  await page.goto(`/blog/${slug}`);
  const player = page.locator(".music-player");
  const audio = player.locator("audio");
  await expect(player.getByRole("button", { name: "展开音乐播放器" })).toBeVisible();
  await page.getByRole("button", { name: "播放歌单", exact: true }).click();
  await expect
    .poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(0.2);
  await player.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(audio).toHaveJSProperty("paused", true);
  const slider = player.getByRole("slider", { name: "播放进度" });
  await slider.focus();
  await slider.press("ArrowRight");
  await expect
    .poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(4);
  await player.getByRole("slider", { name: "音量" }).focus();
  // 模拟正常按压时长，避免合成按键快于音量事件的 25ms 节流。
  for (const volume of [0.25, 0.2, 0.15, 0.1, 0.05, 0]) {
    await player.getByRole("slider", { name: "音量" }).press("ArrowLeft", { delay: 50 });
    await expect(audio).toHaveJSProperty("volume", volume);
  }
  await expect(audio).toHaveJSProperty("volume", 0);
  await player.getByRole("button", { name: "下一首" }).click();
  await expect(player.getByText("第二首", { exact: true })).toBeVisible();
  await expect
    .poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(0.1);
  await audio.evaluate((el) => {
    el.dataset.mark = "persistent";
  });
  await page.locator("header nav").getByText("音乐", { exact: true }).click();
  await expect(page).toHaveURL("/music");
  await expect(page.getByRole("heading", { name: "音乐", exact: true })).toBeVisible();
  await expect(audio).toHaveAttribute("data-mark", "persistent");
  await expect(audio).toHaveJSProperty("paused", false);
  await expect(audio).toHaveJSProperty("volume", 0);
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: testInfo.outputPath("music-desktop.png") });
});

test("视频：点击前不加载，标准控制可播放 MP4 和带参数 HLS，错误可重试", async ({ page }) => {
  let requested = 0;
  page.on("request", (req) => {
    if (req.url().includes("/__media/")) requested++;
  });
  await page.goto(`/blog/${slug}`);
  const videos = page.getByRole("region", { name: "视频播放器" });
  await expect(videos).toHaveCount(3);
  expect(requested).toBe(0);
  for (const index of [0, 1]) {
    const player = videos.nth(index);
    await player.getByRole("button", { name: "播放视频", exact: true }).click();
    await expect
      .poll(() => player.locator("video").evaluate((el: HTMLVideoElement) => el.currentTime))
      .toBeGreaterThan(0.2);
    await player.hover();
    await player.getByRole("button", { name: "播放视频", exact: true }).click();
    await expect(player.locator("video")).toHaveJSProperty("paused", true);
  }
  const failed = videos.nth(2);
  await failed.getByRole("button", { name: "播放视频", exact: true }).click();
  await expect(failed.getByText("视频加载失败")).toBeVisible();
  await expect(failed.getByRole("link", { name: "在新窗口打开" })).toHaveAttribute(
    "href",
    media("missing.mp4"),
  );
  await page.route("**/__media/missing.mp4", (route) => fulfillMedia(route, "sample.mp4"));
  await failed.getByRole("button", { name: "重试" }).click();
  await expect
    .poll(() => failed.locator("video").evaluate((el: HTMLVideoElement) => el.currentTime))
    .toBeGreaterThan(0.2);
});

test("音乐：恢复音量偏好，静音后刷新保持静音", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("i.player"))
      localStorage.setItem(
        "i.player",
        JSON.stringify({ state: { volume: 0.65, muted: false }, version: 0 }),
      );
  });
  await page.goto(`/blog/${slug}`);
  const player = page.locator(".music-player");
  const audio = player.locator("audio");
  await page.getByRole("button", { name: "播放歌单", exact: true }).click();
  await expect(audio).toHaveJSProperty("volume", 0.65);
  await player.getByRole("button", { name: "静音", exact: true }).click();
  await expect(audio).toHaveJSProperty("muted", true);
  await expect(player.getByRole("button", { name: "取消静音", exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "播放歌单", exact: true }).click();
  await expect(audio).toHaveJSProperty("volume", 0.65);
  await expect(audio).toHaveJSProperty("muted", true);
});

test("音乐：媒体请求失败后降级仍可播放，并保留静音", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "i.player",
      JSON.stringify({ state: { volume: 0.65, muted: true }, version: 0 }),
    ),
  );
  let requests = 0;
  await page.route("**/__media/tone.wav?*", async (route) => {
    requests++;
    if (requests === 1) return route.abort("failed");
    return fulfillMedia(route, "tone.wav");
  });
  await page.goto(`/blog/${slug}`);
  await page.getByRole("button", { name: "播放歌单", exact: true }).click();
  const audio = page.locator(".music-player audio");
  await expect
    .poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(0.2);
  await expect(audio).toHaveJSProperty("crossOrigin", null);
  await expect(audio).toHaveJSProperty("muted", true);
  expect(requests).toBeGreaterThan(1);
});

test("窄屏视频：标准布局可播放且不横向溢出", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/blog/${slug}`);
  const player = page.getByRole("region", { name: "视频播放器" }).first();
  await player.getByRole("button", { name: "播放视频", exact: true }).click();
  await expect
    .poll(() => player.locator("video").evaluate((el: HTMLVideoElement) => el.currentTime))
    .toBeGreaterThan(0.2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(player.locator("video")).toHaveAttribute("playsinline", "");
  await player.screenshot({ path: testInfo.outputPath("video-mobile.png") });
});

test("单曲结束后循环同一个 URL，从头继续播放", async ({ page }) => {
  await page.route("https://api.injahow.cn/meting/**", (route) =>
    route.fulfill({ json: [songs[0]] }),
  );
  await page.goto(`/blog/${slug}`);
  await page.getByRole("button", { name: "播放歌单", exact: true }).click();
  const audio = page.locator(".music-player audio");
  await expect
    .poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(0.2);
  // 加速到结束前；等待真实 ended 事件走自动切歌分支。
  await audio.evaluate((el: HTMLAudioElement) => {
    el.currentTime = el.duration - 0.1;
  });
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime)).toBeLessThan(1);
  await expect
    .poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(0.2);
  await expect(audio).toHaveJSProperty("paused", false);
});

test("暂停后发生媒体错误，降级恢复不擅自开始播放", async ({ page }) => {
  await page.goto(`/blog/${slug}`);
  await page.getByRole("button", { name: "播放歌单", exact: true }).click();
  const player = page.locator(".music-player");
  const audio = player.locator("audio");
  await expect
    .poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(0.2);
  await player.getByRole("button", { name: "暂停", exact: true }).click();
  await audio.evaluate((el) => el.dispatchEvent(new Event("error")));
  await expect(audio).toHaveJSProperty("crossOrigin", null);
  await expect(audio).toHaveJSProperty("readyState", 4);
  await expect(audio).toHaveJSProperty("paused", true);
  await player.getByRole("button", { name: "播放", exact: true }).click();
  await expect
    .poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(0.2);
});
