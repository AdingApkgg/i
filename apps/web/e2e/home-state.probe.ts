import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { navigateMain } from "./navigation-helpers";

// 仅通过只读配置显式启用：配套进程用外部 Node hook 注入 SELECT 结果，不改生产源码或数据库。
const faultFile = process.env.SAO_HOME_FAULT_FILE ?? "";
const stateURL = process.env.SAO_HOME_STATE_URL ?? "";
test.use({ baseURL: stateURL });
test.beforeAll(() => {
  expect(faultFile, "需要独立故障文件").not.toBe("");
  expect(stateURL, "需要独立故障预览").not.toBe("");
});
async function clearInjection() {
  await rm(faultFile, { force: true });
  await rm(`${faultFile}.hold`, { force: true });
}
test.beforeEach(clearInjection);
test.afterEach(clearInjection);
const inject = (mode: Record<string, "error" | "empty" | "one" | "wait">) =>
  writeFile(faultFile, JSON.stringify(mode));
async function screenshot(page: Page, name: string) {
  const directory = process.env.SAO_HOME_EVIDENCE_DIR;
  if (directory) {
    await mkdir(`${directory}/screenshots`, { recursive: true });
    await page.screenshot({ path: `${directory}/screenshots/${name}.png` });
  }
}

test("文章故障不缓存、不抹掉成功内容；慢响应和重复点击只发一次真实读取", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "no-preference" });
  const response = await request.post("/api/rpc/blog/list", { data: { json: {} } });
  expect(response.ok()).toBe(true);
  const posts = (await response.json()).json as { title: string }[];
  await inject({ post: "error" });
  const document = await page.goto("/");
  expect(document!.headers()["cache-control"]).toBe("private, no-store");
  expect(document!.headers()["cdn-cache-control"]).toBeUndefined();
  const journal = page.locator("#journal");
  await expect(journal.getByRole("alert")).toContainText("文章暂时未能读取");
  await expect(page.locator("#moments")).toHaveAttribute("data-state", "ready");
  await expect(page.locator("#projects")).toHaveAttribute("data-state", "ready");
  const moments = await page.locator("#moments").textContent();
  const projects = await page.locator("#projects").textContent();
  await journal.scrollIntoViewIfNeeded();
  await screenshot(page, "state-dark-error-390");
  await rm(faultFile, { force: true });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let reads = 0;
  await page.route("**/api/rpc/blog/list", async (route) => {
    reads++;
    const result = await route.fetch();
    await gate;
    await route.fulfill({ response: result });
  });
  try {
    await journal.getByRole("button", { name: "重试", exact: true }).focus();
    await journal.evaluate((section) => {
      const button = section.querySelector("button")!;
      button.click();
      button.click();
    });
    await expect(journal).toHaveAttribute("aria-busy", "true");
    await expect(journal.getByRole("status")).toContainText("正在读取文章");
    await expect.poll(() => reads).toBe(1);
    expect(await page.locator("#moments").textContent()).toBe(moments);
    expect(await page.locator("#projects").textContent()).toBe(projects);
    expect(
      await journal
        .locator(".reading-skeleton i")
        .evaluateAll((nodes) =>
          nodes.every((node) => getComputedStyle(node).animationName === "none"),
        ),
    ).toBe(true);
    await screenshot(page, "state-dark-loading-390");
  } finally {
    release();
  }
  await expect(journal.locator("article h3")).toHaveText(
    posts.slice(0, 3).map((post) => post.title),
  );
  await expect(journal.getByRole("heading", { name: "最近文章", exact: true })).toBeFocused();
  expect(reads).toBe(1);
  expect(await page.locator("#moments").textContent()).toBe(moments);
  expect(await page.locator("#projects").textContent()).toBe(projects);
  await screenshot(page, "state-dark-recovered-390");
});

test("再次失败仍可重试且焦点有落点，不向页面泄漏内部故障", async ({ page }) => {
  await inject({ post: "error" });
  await page.goto("/");
  const journal = page.locator("#journal");
  await journal.getByRole("button", { name: "重试", exact: true }).click();
  await expect(journal.getByRole("alert")).toContainText("文章暂时未能读取");
  await expect(journal.getByRole("heading", { name: "最近文章", exact: true })).toBeFocused();
  await expect(journal.getByRole("button", { name: "重试", exact: true })).toBeEnabled();
  await expect(page.locator("body")).not.toContainText("isolated-home-read-failure");
  await rm(faultFile, { force: true });
  await journal.getByRole("button", { name: "重试", exact: true }).click();
  await expect(journal.locator("article")).toHaveCount(3);
});

test("三个读取成功为空时没有假内容、假重试或死锚点", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await inject({ post: "empty", moment: "empty", project: "empty" });
  const document = await page.goto("/");
  expect(document!.headers()["cache-control"]).toBe("public, max-age=0, must-revalidate");
  await expect(page.locator(".reading-no-content")).toContainText("暂无可展示的公开内容");
  await expect(page.locator("[data-content-section]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "重试", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "读文章", exact: true })).toHaveAttribute(
    "href",
    "/blog",
  );
  await expect(page.getByRole("link", { name: "看作品", exact: true })).toHaveAttribute(
    "href",
    "/projects",
  );
  await screenshot(page, "state-light-empty-390");
});

test("一篇真实文章自然收缩，不凑满说说和作品，也不加载随机封面", async ({ page, request }) => {
  const response = await request.post("/api/rpc/blog/list", { data: { json: {} } });
  const original = (await response.json()).json as { title: string }[];
  await inject({ post: "one", moment: "empty", project: "empty" });
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/");
  await expect(page.locator("#journal article h3")).toHaveText([original[0]!.title]);
  await expect(page.locator("#journal article")).toBeInViewport();
  await expect(page.locator("#moments, #projects")).toHaveCount(0);
  await expect(page.locator('img[src*="picsum.photos"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
  await screenshot(page, "state-light-sparse-320");
});

test("一个模块失败、另一个为空时保留成功文章；真实重试可以返回成功空", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await inject({ moment: "error", project: "empty" });
  await page.goto("/");
  await expect(page.locator("#journal article")).toHaveCount(3);
  const posts = await page.locator("#journal").textContent();
  await expect(page.locator("#moments").getByRole("alert")).toContainText("说说暂时未能读取");
  await expect(page.locator("#projects")).toHaveCount(0);
  await inject({ moment: "empty", project: "empty" });
  await page.locator("#moments").getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.locator("#moments").getByRole("status")).toContainText("暂时还没有公开说说");
  await expect(
    page.locator("#moments").getByRole("heading", { name: "最近说说", exact: true }),
  ).toBeFocused();
  expect(await page.locator("#journal").textContent()).toBe(posts);
});

test("离页真实取消读取；新首页完成后旧响应迟到不得补回内容或抢焦点", async ({ page }) => {
  await inject({ post: "error" });
  await page.goto("/");
  const started = new Date().toISOString();
  await writeFile(`${faultFile}.hold`, "旧响应等待新页面完成");
  await inject({ post: "wait" });
  let aborted = false;
  page.on("requestfailed", (request) => {
    if (
      new URL(request.url()).pathname === "/api/rpc/blog/list" &&
      /ERR_ABORTED/.test(request.failure()?.errorText ?? "")
    )
      aborted = true;
  });
  await page.locator("#journal").getByRole("button", { name: "重试", exact: true }).click();
  await expect(page.locator("#journal")).toHaveAttribute("aria-busy", "true");
  const eventSeen = async (released: boolean) =>
    (await readFile(join(dirname(faultFile), "fault-events.ndjson"), "utf8"))
      .trim()
      .split("\n")
      .some((line) => {
        const event = JSON.parse(line) as {
          at: string;
          table: string;
          mode: string;
          phase?: string;
        };
        return (
          event.at >= started &&
          event.table === "post" &&
          event.mode === "wait" &&
          (event.phase === "released") === released
        );
      });
  await expect.poll(() => eventSeen(false)).toBe(true);
  await navigateMain(page, "作品列表", "作品");
  await expect(page).toHaveURL("/projects");
  await expect.poll(() => aborted).toBe(true);
  await inject({ post: "empty" });
  await navigateMain(page, "首页");
  await expect(page).toHaveURL("/");
  await expect(page.locator("#journal")).toHaveCount(0);
  const focus = () =>
    page.evaluate(() => ({
      id: document.activeElement?.id,
      text: document.activeElement?.textContent,
    }));
  const before = await focus();
  await rm(`${faultFile}.hold`, { force: true });
  await expect.poll(() => eventSeen(true)).toBe(true);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await expect(page.locator("#journal")).toHaveCount(0);
  expect(await focus()).toEqual(before);
  await expect(page.locator("#moments")).toHaveAttribute("data-state", "ready");
});
