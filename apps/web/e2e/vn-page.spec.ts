import { request } from "@playwright/test";
import { ADMIN_STATE, expect, test } from "./fixtures";

/**
 * 视觉小说页的排版契约：状态分布、系列章节、无封面首字占位、窄屏单列无溢出。
 * 自建数据（唯一后缀）避免依赖 seed 存量，跑完即删。
 */
const stamp = Date.now();
const series = `e2e万华镜${stamp}`;
const titles = [`${series} -第一话-`, `${series} -第二话-`, `${series} -第三话-`];
const single = `e2e孤雄${stamp}`;
const created: string[] = [];

test.describe("视觉小说页排版", () => {
  test.beforeAll(async ({ baseURL }) => {
    const api = await request.newContext({
      baseURL: baseURL!,
      storageState: ADMIN_STATE,
      extraHTTPHeaders: { origin: baseURL! },
    });
    const make = async (data: Record<string, unknown>) => {
      const response = await api.post("/api/rpc/vn/create", { data: { json: data } });
      expect(response.ok(), await response.text()).toBe(true);
      const body = (await response.json()) as { json: { id: string } };
      created.push(body.json.id);
    };
    await make({
      title: titles[0],
      status: "通关",
      rating: 9,
      tags: "纯爱,校园",
      platforms: "Windows",
      lengthMinutes: 720,
    });
    await make({ title: titles[1], status: "搁置", rating: 7 });
    await make({ title: titles[2], status: "在玩", lengthMinutes: 1200 });
    await make({ title: single, status: "通关", rating: 8, platforms: "Windows" });
    await api.dispose();
  });

  test.afterAll(async ({ baseURL }) => {
    const api = await request.newContext({
      baseURL: baseURL!,
      storageState: ADMIN_STATE,
      extraHTTPHeaders: { origin: baseURL! },
    });
    for (const id of created) await api.post("/api/rpc/vn/delete", { data: { json: { id } } });
    await api.dispose();
  });

  test("系列分组、状态分布与首字占位", async ({ page }) => {
    await page.goto("/vn");
    await expect(page.getByText(/共 \d+ 部/)).toBeVisible();
    await expect(page.getByText(/通关 \d+/)).toBeVisible();
    await expect(page.getByText(/\d+ 个系列/)).toBeVisible();
    await expect(page.getByRole("heading", { name: /e2e万华镜/ }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "单独记录" })).toBeVisible();
    await expect(page.getByText("01", { exact: true }).first()).toBeVisible();
    // 无封面的条目用首字占位块，且不渲染 <img>
    const placeholder = page.locator("li").filter({ hasText: single }).first();
    await expect(placeholder).toContainText("e");
    await expect(placeholder.locator("img")).toHaveCount(0);
    const listed = page
      .locator("li")
      .filter({ hasText: titles[0] ?? "" })
      .first();
    await expect(listed).toContainText("纯爱");
    await expect(listed).toContainText("官方时长约 12 小时");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });

  test("窄屏单列、无横向溢出", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/vn");
    const list = page
      .locator("ol")
      .filter({ hasText: titles[0] ?? "" })
      .first();
    const columns = await list.evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(" ").length,
    );
    expect(columns).toBe(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
});
