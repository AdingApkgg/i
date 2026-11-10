import { expect, test } from "./fixtures";
import { navigateMain } from "./navigation-helpers";

// 已确认的阅读版不再使用共享滑动高亮；保留连续跨组、唯一当前项、几何与减少动态的验收意图。
for (const width of [390, 799, 800, 1440]) {
  for (const reduce of [false, true]) {
    test(`连续跨组只有一个可识别当前项（${width}px，减少动态=${reduce}）`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: reduce ? "reduce" : "no-preference" });
      await page.goto("/");
      for (const [label, group, path] of [
        ["音乐", "收藏", "/music"],
        ["舞萌", "兴趣", "/maimai"],
        ["相册", "日常", "/gallery"],
      ] as const) {
        await navigateMain(page, label, group);
        await expect(page).toHaveURL(path);
        if (width < 800) await page.getByRole("button", { name: "栏目", exact: true }).click();
        const nav = page.getByRole("navigation", {
          name: width < 800 ? "手机全部栏目" : "桌面主导航",
          exact: true,
        });
        const current = nav.getByRole("link", { name: label, exact: true });
        await expect(current).toHaveAttribute("aria-current", "page");
        await expect(nav.locator('a[aria-current="page"]')).toHaveCount(1);
        await current.focus();
        await expect(current).toBeInViewport();
        const style = await current.evaluate((node) => ({
          weight: getComputedStyle(node).fontWeight,
          decoration: getComputedStyle(node).textDecorationLine,
          transform: getComputedStyle(node).transform,
          animation: getComputedStyle(node).animationName,
        }));
        expect(Number(style.weight)).toBeGreaterThanOrEqual(600);
        expect(style.decoration).toContain("underline");
        expect(style.transform).toBe("none");
        expect(style.animation).toBe("none");
        await expect(nav.locator("[data-nav-highlight]")).toHaveCount(0);
        if (width < 800) await page.keyboard.press("Escape");
      }
    });
  }
}
