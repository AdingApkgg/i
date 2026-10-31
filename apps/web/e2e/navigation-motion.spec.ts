import { expect, test } from "./fixtures";
import { navigateMain } from "./navigation-helpers";

// 删除可见高亮、遗留多个高亮或切组后高亮留在原处，应在连续目标上失败。
for (const width of [390, 1440]) {
  for (const reduce of [false, true]) {
    test(`连续跨组切页后只有一个可见高亮且位于目标内（${width}px，减少动态=${reduce}）`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: reduce ? "reduce" : "no-preference" });
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      const nav = page.getByRole("navigation", { name: "主导航" });
      for (const [label, group, path] of [
        ["音乐", "收藏", "/music"],
        ["舞萌", "兴趣", "/maimai"],
        ["相册", "日常", "/gallery"],
      ] as const) {
        await navigateMain(page, label, group);
        await expect(page).toHaveURL(path);
        const current =
          width < 1024
            ? nav.getByRole("button", { name: group, exact: true })
            : nav.getByRole("link", { name: label, exact: true });
        const highlight = nav.locator("[data-nav-highlight]:visible");
        await expect(highlight).toHaveCount(1);
        await expect
          .poll(async () => {
            const target = await current.boundingBox(),
              marker = await highlight.boundingBox();
            return (
              !!target &&
              !!marker &&
              marker.width > 0 &&
              marker.height > 0 &&
              marker.x >= target.x - 1 &&
              marker.y >= target.y - 1 &&
              marker.x + marker.width <= target.x + target.width + 1 &&
              marker.y + marker.height <= target.y + target.height + 1
            );
          })
          .toBe(true);
      }
    });
  }
}
