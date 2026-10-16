import { ADMIN_STATE, expect, test } from "./fixtures";

test("每日次数公开展示，全年日历完整且小屏只在图内滚动", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto("/masturbation?year=2024");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(page.getByRole("heading", { name: "自慰记录", exact: true })).toBeVisible();
  const calendar = page.getByRole("region", { name: "年度日历热力图" });
  await expect(calendar.getByRole("button")).toHaveCount(366);
  expect(await calendar.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await calendar.getByRole("button", { name: /^2024-01-01：/ }).click();
  await expect(calendar.getByRole("button", { name: /^2024-01-01：/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "保存次数", exact: true })).toHaveCount(0);
  const denied = await page.request.post("/api/rpc/dailyRecord/save", {
    data: { json: { date: "2024-02-29", count: 1 } },
  });
  expect(denied.status()).toBe(401);
});

test("非法年份返回 400，不生成假记录", async ({ page }) => {
  const response = await page.goto("/masturbation?year=abc");
  expect(response?.status()).toBe(400);
});

test.describe("每日记录编辑", () => {
  test.use({ storageState: ADMIN_STATE });
  test("补记跨年日期、修改、+1、公开可见和清除", async ({ page, request }) => {
    const date = "2024-02-29";
    const before =
      (
        await (
          await request.post("/api/rpc/dailyRecord/year", { data: { json: { year: 2024 } } })
        ).json()
      ).json.days.find((d: { date: string }) => d.date === date)?.count ?? 0;
    try {
      await page.goto("/dash/masturbation");
      await page.getByLabel("日期", { exact: true }).fill(date);
      await page.getByLabel("次数", { exact: true }).fill("2");
      await page.getByRole("button", { name: "保存次数", exact: true }).click();
      await expect(page).toHaveURL(/year=2024/);
      await expect(page.getByRole("heading", { name: "2024 年", exact: true })).toBeVisible();
      await expect(page.getByLabel("日期", { exact: true })).toHaveValue(date);
      await expect(page.getByLabel("次数", { exact: true })).toHaveValue("2");
      await page.getByLabel("次数", { exact: true }).fill("4");
      await page.getByRole("button", { name: "保存次数", exact: true }).click();
      await expect(page.getByRole("button", { name: `${date}：4 次`, exact: true })).toBeVisible();
      await page.getByRole("button", { name: "当天 +1", exact: true }).click();
      await expect(page.getByRole("button", { name: `${date}：5 次`, exact: true })).toBeVisible();
      await page.goto("/masturbation?year=2024");
      await expect(page.getByRole("button", { name: `${date}：5 次`, exact: true })).toBeVisible();
      await page.goto(`/dash/masturbation?year=2024&date=${date}`);
      await page.getByRole("button", { name: "清除当天", exact: true }).click();
      await expect(page.getByRole("button", { name: `${date}：0 次`, exact: true })).toBeVisible();
      await expect(page.getByLabel("次数", { exact: true })).toHaveValue("0");
    } finally {
      const restored = await request.post("/api/rpc/dailyRecord/save", {
        data: { json: { date, count: before } },
      });
      expect(restored.ok()).toBe(true);
    }
  });
});
