import { expect, test } from "./fixtures";

const VARIANTS = ["default", "soft", "outline", "ghost", "destructive"] as const;
const SHOT = { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.005 } as const;

test.describe("设计系统交互状态", () => {
  test("五种变体提供可交互、禁用和加载状态，键盘跳过不可用按钮", async ({ page }) => {
    await page.goto("/design");
    const matrix = page.getByTestId("button-state-matrix");
    for (const variant of VARIANTS) {
      const row = matrix.getByTestId(`button-state-${variant}`);
      await expect(row.getByRole("button", { name: "试用", exact: true })).toBeEnabled();
      await expect(row.getByRole("button", { name: "不可用", exact: true })).toBeDisabled();
      const loading = row.getByRole("button", { name: "加载中", exact: true });
      await expect(loading).toBeDisabled();
      await expect(loading).toHaveAttribute("aria-busy", "true");
    }

    const first = matrix.getByTestId("button-state-default").getByRole("button", { name: "试用" });
    const next = matrix.getByTestId("button-state-soft").getByRole("button", { name: "试用" });
    await first.focus();
    await page.keyboard.press("Tab");
    await expect(next).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("button-interaction-result")).toHaveText("已触发 1 次本地交互");
  });

  test("反馈演示可切换加载、错误、重试与完成，不发出业务请求", async ({ page }) => {
    await page.goto("/design");
    const demo = page.getByTestId("feedback-state-demo");
    await expect(demo.getByRole("radio", { name: "就绪", exact: true })).toBeEnabled();
    const requests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      const businessApi =
        url.origin === new URL(page.url()).origin && url.pathname.startsWith("/api/");
      // 播放器与看板娘有独立的资源读取；这里只观察业务 API 和所有写请求。
      if (request.method() !== "GET" || businessApi) {
        requests.push(`${request.method()} ${request.url()}`);
      }
    });

    await demo.getByRole("radio", { name: "加载中", exact: true }).check();
    await expect(demo.getByRole("button", { name: "处理中", exact: true })).toBeDisabled();
    await expect(demo.getByRole("button", { name: "处理中", exact: true })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(demo.getByRole("status")).toContainText("正在演示加载状态");

    await demo.getByRole("radio", { name: "失败", exact: true }).check();
    await expect(demo.getByRole("alert")).toContainText("演示失败，未发送任何请求");
    await demo.getByRole("button", { name: "重试演示", exact: true }).click();
    await expect(demo.getByRole("radio", { name: "加载中", exact: true })).toBeChecked();
    await expect(demo.getByRole("alert")).toHaveCount(0);

    await demo.getByRole("radio", { name: "完成", exact: true }).check();
    await expect(demo.getByRole("status")).toContainText("演示完成，没有保存任何数据");
    await demo.getByRole("radio", { name: "就绪", exact: true }).check();
    await demo.getByRole("button", { name: "开始演示", exact: true }).click();
    await expect(demo.getByRole("radio", { name: "加载中", exact: true })).toBeChecked();
    expect(requests).toEqual([]);
  });

  for (const colorScheme of ["light", "dark"] as const) {
    for (const variant of VARIANTS) {
      test(`${colorScheme} ${variant}：真实悬停、按下和键盘焦点视觉`, async ({ page }) => {
        await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
        await page.goto("/design");
        const row = page.getByTestId(`button-state-${variant}`);
        const button = row.getByRole("button", { name: "试用", exact: true });
        await expect(button).toBeEnabled();
        const resting = await button.evaluate((el) => {
          const style = getComputedStyle(el);
          return {
            background: style.backgroundColor,
            filter: style.filter,
            shadow: style.boxShadow,
            translate: style.translate,
          };
        });
        await button.hover();
        await expect.poll(() => button.evaluate((el) => el.matches(":hover"))).toBe(true);
        await expect
          .poll(() =>
            button.evaluate((el) => {
              const style = getComputedStyle(el);
              return { background: style.backgroundColor, filter: style.filter };
            }),
          )
          .not.toEqual({ background: resting.background, filter: resting.filter });
        await expect(row).toHaveScreenshot(`${variant}-${colorScheme}-hover.png`, SHOT);

        await page.mouse.down();
        try {
          await expect.poll(() => button.evaluate((el) => el.matches(":active"))).toBe(true);
          // 只有 default / soft 定义了额外的按下位移，不为其他变体虚构 active 样式。
          if (variant === "default" || variant === "soft") {
            await expect(button).not.toHaveCSS("translate", resting.translate);
          }
          await expect(row).toHaveScreenshot(`${variant}-${colorScheme}-active.png`, SHOT);
        } finally {
          await page.mouse.up();
        }
        await expect(page.getByTestId("button-interaction-result")).toHaveText(
          "已触发 1 次本地交互",
        );

        await page.mouse.move(0, 0);
        await button.focus();
        await page.keyboard.press("Tab");
        await page.keyboard.press("Shift+Tab");
        await expect(button).toBeFocused();
        await expect.poll(() => button.evaluate((el) => el.matches(":focus-visible"))).toBe(true);
        await expect(button).not.toHaveCSS("box-shadow", "none");
        await expect(button).not.toHaveCSS("box-shadow", resting.shadow);
        await expect(row).toHaveScreenshot(`${variant}-${colorScheme}-focus.png`, SHOT);
      });
    }

    test(`${colorScheme}：反馈加载与错误视觉，减少动态效果时不旋转`, async ({ page }) => {
      await page.emulateMedia({ colorScheme, reducedMotion: "reduce" });
      await page.goto("/design");
      const demo = page.getByTestId("feedback-state-demo");
      await demo.getByRole("radio", { name: "加载中", exact: true }).check();
      await page.mouse.move(0, 0);
      await expect(
        demo.getByRole("button", { name: "处理中", exact: true }).locator("svg"),
      ).toHaveCSS("animation-name", "none");
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect(demo).toHaveScreenshot(`feedback-${colorScheme}-loading.png`, SHOT);
      await demo.getByRole("radio", { name: "失败", exact: true }).check();
      await page.mouse.move(0, 0);
      await expect(demo).toHaveScreenshot(`feedback-${colorScheme}-error.png`, SHOT);
    });
  }

  test("手机：交互矩阵和错误反馈不横向溢出", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/design");
    const demo = page.getByTestId("feedback-state-demo");
    await demo.getByRole("radio", { name: "失败", exact: true }).check();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.mouse.move(0, 0);
    const matrix = page.getByTestId("button-state-matrix");
    await matrix.evaluate((el) => el.scrollIntoView({ block: "start" }));
    await expect(matrix).toHaveScreenshot("buttons-mobile.png", SHOT);
    // 元素截图只考虑视口边界，不会避让 fixed 底栏；滚到底后再检查真实点选命中。
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const retry = demo.getByRole("button", { name: "重试演示", exact: true });
    await expect
      .poll(() =>
        retry.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          return el.contains(
            document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2),
          );
        }),
      )
      .toBe(true);
    await expect(demo).toHaveScreenshot("feedback-mobile-error.png", SHOT);
    await retry.click();
    await expect(demo.getByRole("button", { name: "处理中", exact: true })).toBeDisabled();
  });
});
