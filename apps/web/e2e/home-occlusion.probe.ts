import { expect, test } from "./fixtures";

// 可见态诊断补出的真实回归；不能以默认收起、删测或缩小断言范围掩盖。
test.use({ showMascot: true, viewport: { width: 900, height: 1000 } });
test("可见看板娘不应遮挡首页首屏内的正文入口", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "i.mascot",
      JSON.stringify({ state: { hidden: false, group: 0, costume: 1 }, version: 0 }),
    ),
  );
  await page.goto("/");
  await expect(page.locator("#waifu-canvas")).toBeVisible();
  await page.waitForLoadState("networkidle");
  const obscured = await page
    .locator(".public-main a, .public-main button")
    .evaluateAll((elements) =>
      elements.flatMap((element) => {
        const rect = element.getBoundingClientRect();
        const x = rect.x + rect.width / 2,
          y = rect.y + rect.height / 2;
        if (
          rect.width === 0 ||
          rect.height === 0 ||
          x < 0 ||
          y < 0 ||
          x >= innerWidth ||
          y >= innerHeight
        )
          return [];
        const hit = document.elementFromPoint(x, y);
        return hit && (hit === element || element.contains(hit))
          ? []
          : [{ text: element.textContent?.trim(), interceptedBy: `${hit?.tagName}#${hit?.id}` }];
      }),
    );
  expect(obscured, "正文入口被浮动层拦截；需要确认共存布局后修正").toEqual([]);
});
