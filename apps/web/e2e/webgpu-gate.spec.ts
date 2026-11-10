import { expect, type Page, test } from "@playwright/test";

/**
 * 开启态独立运行：不依赖 CI 是否恰好有硬件 GPU，也不跳过服务配置错误。
 * 能力替身只驱动准入判断；实际硬件绘制不是这组测试的验证范围。
 */
async function useAdapter(
  page: Page,
  kind: "no-api" | "no-adapter" | "software" | "error" | "hardware",
) {
  await page.addInitScript((kind) => {
    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value:
        kind === "no-api"
          ? undefined
          : {
              requestAdapter: async () => {
                const root = document.documentElement;
                root.dataset.gateRequests = String(Number(root.dataset.gateRequests ?? 0) + 1);
                if (kind === "error") throw new Error("GPU process unavailable");
                return kind === "no-adapter"
                  ? null
                  : { info: { isFallbackAdapter: kind === "software" } };
              },
            },
    });
  }, kind);
}

test.beforeEach(async ({ page, baseURL }) => {
  // 只使用本站资源；业务初始化与管理员账号不属于准入回归。
  const origin = new URL(baseURL!).origin;
  await page.route(
    (url) => url.origin !== origin,
    (route) => route.abort(),
  );
  await page.addInitScript(() =>
    localStorage.setItem(
      "i.mascot",
      JSON.stringify({ state: { hidden: true, group: null, costume: 0 }, version: 0 }),
    ),
  );
});

test.describe("WebGPU 闸门开启", () => {
  test("没有硬件适配器时首页被整屏拦下", async ({ page }) => {
    await useAdapter(page, "no-adapter");
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-webgpu-gate", "blocked");
    const gate = page.locator(".webgpu-gate");
    await expect(gate).toBeVisible();
    await expect(gate.getByRole("heading", { level: 1 })).toHaveText("这台设备暂时进不来");
    await expect(gate).toHaveAttribute("data-webgpu-gate-reason", "no-adapter");
    await expect(gate).toContainText("适配器");
    await expect(gate.getByRole("button", { name: "重新检测" })).toBeFocused();
    await expect(page.locator(".public-chrome")).toBeHidden();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: test.info().outputPath("gate-home.png"), fullPage: true });
  });

  test("其它路由同样被拦，重新检测会再次请求适配器", async ({ page }) => {
    await useAdapter(page, "no-adapter");
    await page.goto("/blog");
    const gate = page.locator(".webgpu-gate");
    await expect(gate).toBeVisible();
    await expect(page.locator(".public-chrome")).toBeHidden();
    const attempts = await page.evaluate(() =>
      Number(document.documentElement.dataset.gateRequests),
    );
    await gate.getByRole("button", { name: "重新检测" }).click();
    await expect
      .poll(() => page.evaluate(() => Number(document.documentElement.dataset.gateRequests)))
      .toBeGreaterThan(attempts);
    await expect(gate).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-webgpu-gate", "blocked");
    await page.screenshot({ path: test.info().outputPath("gate-blog.png"), fullPage: true });
  });

  test("矮屏上闸门页可滚动到底，不被裁掉", async ({ page }) => {
    await useAdapter(page, "no-adapter");
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/");
    await expect(page.locator(".webgpu-gate")).toBeVisible();
    const reach = await page.evaluate(() => {
      const box = document.querySelector<HTMLElement>(".webgpu-gate")!;
      box.scrollTop = box.scrollHeight;
      const foot = document.querySelector(".webgpu-gate-foot")!.getBoundingClientRect();
      box.scrollTop = 0;
      const title = document.querySelector(".webgpu-gate-title")!.getBoundingClientRect();
      return {
        footBottom: Math.round(foot.bottom),
        viewport: innerHeight,
        titleTop: Math.round(title.top),
      };
    });
    expect(reach.titleTop).toBeGreaterThanOrEqual(0);
    expect(reach.footBottom).toBeLessThanOrEqual(reach.viewport + 1);
  });

  test("手机上闸门页同样不横向溢出", async ({ page }) => {
    await useAdapter(page, "no-adapter");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator(".webgpu-gate")).toBeVisible();
    const metrics = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - innerWidth,
      card: document.querySelector(".webgpu-gate-card")!.getBoundingClientRect().width,
    }));
    expect(metrics.overflow).toBeLessThanOrEqual(0);
    expect(metrics.card).toBeLessThanOrEqual(390);
    await page.screenshot({ path: test.info().outputPath("gate-390.png"), fullPage: true });
  });

  for (const reason of ["no-api", "software", "error"] as const) {
    test(`检测为 ${reason} 时，后台入口也被拦截`, async ({ page }) => {
      await useAdapter(page, reason);
      await page.goto("/dash/login");
      await expect(page.locator(".webgpu-gate")).toBeVisible();
      await expect(page.locator(".webgpu-gate")).toHaveAttribute("data-webgpu-gate-reason", reason);
      await expect(page.locator("html")).toHaveAttribute("data-webgpu-gate", "blocked");
    });
  }

  test("非软件适配器通过准入后，正文与演出控制可用", async ({ page }) => {
    await useAdapter(page, "hardware");
    await page.goto("/");
    const stage = page.locator(".reading-stage");
    await expect(stage).toHaveAttribute("data-scene-mode", "reading");
    await expect(page.locator(".webgpu-gate")).toHaveCount(0);
    await expect(page.locator(".public-chrome")).toBeVisible();
    await page.getByRole("button", { name: "演出模式", exact: true }).click();
    await expect(stage).toHaveAttribute("data-scene-mode", "performance");
    await expect(page.locator("html")).not.toHaveAttribute("data-webgpu-gate", "blocked");
  });
});
