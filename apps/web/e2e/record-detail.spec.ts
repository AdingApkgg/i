import { request } from "@playwright/test";
import { ADMIN_STATE, expect, test } from "./fixtures";

/**
 * 二级详情页契约（视觉小说 / 东方）：
 * 列表标题（或卡片）能进详情、详情字段齐全、404 落到站内 404 视图、窄屏不横向溢出。
 * 自建数据（唯一后缀）避免依赖 seed 存量，跑完即删。
 */
const stamp = Date.now();
const series = `e2e详情系列${stamp}`;
const mainTitle = `${series} -第一话-`;
const siblingTitle = `${series} -第二话-`;
const touhouTitle = `e2e东方${stamp}`;
const touhouOriginal = `東方e2e作品${stamp}`;
const zhIntro = `《${mainTitle}》的简介：偏僻小岛上的夏天，几个人一起把假期过完。`;
const originalIntro = `A quiet island story. See https://example.com/some_very_long_token_without_spaces_for_overflow_check for details.`;
const noteText = `e2e 备注：音乐与画面都很稳，适合慢慢读。`;
const vnIds: string[] = [];
const touhouIds: string[] = [];

async function seed(baseURL: string) {
  const api = await request.newContext({
    baseURL,
    storageState: ADMIN_STATE,
    extraHTTPHeaders: { origin: baseURL },
  });
  const create = async (path: string, payload: Record<string, unknown>, bucket: string[]) => {
    const response = await api.post(path, { data: { json: payload } });
    expect(response.ok(), await response.text()).toBe(true);
    const body = (await response.json()) as { json: { id: string } };
    bucket.push(body.json.id);
  };
  await create(
    "/api/rpc/vn/create",
    {
      title: mainTitle,
      brand: "e2e社",
      released: "2026-01-02",
      status: "通关",
      rating: 9,
      playHours: 12,
      lengthMinutes: 720,
      tags: "纯爱,夏日",
      platforms: "Windows,Switch",
      descriptionZh: zhIntro,
      descriptionOriginal: originalIntro,
      note: noteText,
    },
    vnIds,
  );
  await create("/api/rpc/vn/create", { title: siblingTitle, status: "在玩" }, vnIds);
  await create(
    "/api/rpc/touhou/create",
    {
      title: touhouTitle,
      originalTitle: touhouOriginal,
      code: "TH99",
      category: "game",
      status: "通关",
      rating: 8,
      releasedAt: "2026-02-03",
      note: noteText,
    },
    touhouIds,
  );
  await create(
    "/api/rpc/touhou/create",
    { title: `${touhouTitle}外传`, category: "game" },
    touhouIds,
  );
  await api.dispose();
}

test.describe("二级详情页", () => {
  test.beforeAll(async ({ baseURL }) => seed(baseURL!));

  test.afterAll(async ({ baseURL }) => {
    const api = await request.newContext({
      baseURL: baseURL!,
      storageState: ADMIN_STATE,
      extraHTTPHeaders: { origin: baseURL! },
    });
    for (const id of vnIds) await api.post("/api/rpc/vn/delete", { data: { json: { id } } });
    for (const id of touhouIds)
      await api.post("/api/rpc/touhou/delete", { data: { json: { id } } });
    await api.dispose();
  });

  test("视觉小说：列表进详情，字段与同系列条目齐全", async ({ page }) => {
    await page.goto("/vn");
    await page.getByRole("link", { name: mainTitle }).first().click();
    await expect(page.getByRole("heading", { level: 1, name: mainTitle })).toBeVisible();
    await expect(page.getByText("e2e社")).toBeVisible();
    await expect(page.getByText(zhIntro)).toBeVisible();
    await expect(page.getByText(/quiet island story/)).toBeVisible();
    await expect(page.getByText(noteText).first()).toBeVisible();
    await expect(page.getByText("约 12 小时")).toBeVisible();
    await expect(page.getByText("Windows / Switch")).toBeVisible();
    await expect(page.getByText("纯爱")).toBeVisible();
    await expect(page.getByText(/通关/).first()).toBeVisible();
    // 同系列的另一部出现在「相关条目」里，并能点进去
    const related = page.getByRole("link", { name: siblingTitle });
    await expect(related).toBeVisible();
    await related.click();
    await expect(page.getByRole("heading", { level: 1, name: siblingTitle })).toBeVisible();
    // 返程：回到列表页
    // 详情页自己的返回链接（导航里也有同名项，靠 article 作用域区分）
    await page.getByRole("article").getByRole("link", { name: "视觉小说" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "视觉小说" })).toBeVisible();
  });

  test("视觉小说详情：窄屏不横向溢出", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/vn/${vnIds[0]}`);
    await expect(page.getByRole("heading", { level: 1, name: mainTitle })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("东方：卡片进详情，编号与原名都在", async ({ page }) => {
    await page.goto("/touhou");
    await page.getByRole("link", { name: `${touhouTitle} 详情` }).click();
    await expect(page.getByRole("heading", { level: 1, name: touhouTitle })).toBeVisible();
    await expect(page.getByText(/TH99/).first()).toBeVisible();
    await expect(page.getByText(touhouOriginal).first()).toBeVisible();
    await expect(page.getByText("2026.02.03")).toBeVisible();
    await expect(page.getByText(noteText).first()).toBeVisible();
    await expect(page.getByRole("link", { name: `${touhouTitle}外传` })).toBeVisible();
  });

  test("不存在的 id 落到站内 404", async ({ page }) => {
    for (const path of ["/vn/e2e-not-a-real-id", "/touhou/e2e-not-a-real-id"]) {
      const response = await page.goto(path);
      expect(response?.status(), path).toBe(404);
      await expect(page.getByText("这一页迷路了")).toBeVisible();
    }
  });
});
