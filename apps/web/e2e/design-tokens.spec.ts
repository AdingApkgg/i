import { expect, test } from "./fixtures";

// 消费构建产物而不是 grep CSS 源码：缺少 token 映射、改错色值、字号覆盖行高都会失败。
for (const path of ["/", "/dash/login"]) {
  for (const colorScheme of ["light", "dark"] as const) {
    test(`设计刻度保留像素尺寸与继承行高：${path} ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(path);
      const styles = await page.evaluate(() => {
        const host = document.createElement("div");
        host.style.lineHeight = "28px";
        document.body.append(host);
        const result = ["text-micro", "text-caption", "text-code", "text-body"].map((className) => {
          const el = document.createElement("span");
          el.className = className;
          el.textContent = "字号";
          host.append(el);
          const style = getComputedStyle(el);
          return { size: style.fontSize, lineHeight: style.lineHeight };
        });
        host.remove();
        return result;
      });
      expect(styles).toEqual([
        { size: "10px", lineHeight: "28px" },
        { size: "11px", lineHeight: "28px" },
        { size: "13px", lineHeight: "28px" },
        { size: "15px", lineHeight: "28px" },
      ]);
    });

    test(`热力图五档颜色与格子尺寸保持兼容：${path} ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(path);
      const styles = await page.evaluate(() => {
        const host = document.createElement("div");
        host.className = "grid gap-fine";
        document.body.append(host);
        const result = [
          "bg-activity-0",
          "bg-activity-1",
          "bg-activity-2",
          "bg-activity-3",
          "bg-activity-4",
        ].map((color) => {
          const el = document.createElement("div");
          el.className = `size-cell rounded-cell ${color}`;
          host.append(el);
          const style = getComputedStyle(el);
          return {
            color: style.backgroundColor,
            width: style.width,
            height: style.height,
            radius: style.borderRadius,
          };
        });
        const gap = getComputedStyle(host).gap;
        host.remove();
        return { gap, cells: result };
      });
      const colors =
        colorScheme === "light"
          ? [
              "rgb(235, 237, 240)",
              "rgb(155, 233, 168)",
              "rgb(64, 196, 99)",
              "rgb(48, 161, 78)",
              "rgb(33, 110, 57)",
            ]
          : [
              "rgb(22, 27, 34)",
              "rgb(14, 68, 41)",
              "rgb(0, 109, 50)",
              "rgb(38, 166, 65)",
              "rgb(57, 211, 83)",
            ];
      expect(styles.gap).toBe("3px");
      expect(styles.cells).toEqual(
        colors.map((color) => ({ color, width: "13px", height: "13px", radius: "3px" })),
      );
    });

    test(`状态颜色不因主题切换改变原有取值：${path} ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(path);
      const colors = await page.evaluate(() => {
        const host = document.createElement("div");
        document.body.append(host);
        const result = ["bg-info", "bg-warning", "bg-success", "bg-status-error"].map(
          (className) => {
            const el = document.createElement("div");
            el.className = className;
            host.append(el);
            return getComputedStyle(el).backgroundColor;
          },
        );
        host.remove();
        return result;
      });
      expect(colors).toEqual([
        "oklch(0.685 0.169 237.323)",
        "oklch(0.769 0.188 70.08)",
        "oklch(0.696 0.17 162.48)",
        "oklch(0.645 0.246 16.439)",
      ]);
    });
  }
}
