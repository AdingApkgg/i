import { defineConfig, devices } from "@playwright/test";

/**
 * 浏览器端到端测试（e2e/）：跑的是生产构建（build/），需要先 bun run build。
 * 依赖：已迁移 + seed 过的 Postgres、Redis、SeaweedFS（CI 见 .github/workflows/ci.yml 的 e2e 任务）。
 *
 *   bun run build && bun run test:e2e
 *
 * 本地已有服务在跑时会直接复用（E2E_BASE_URL 指向它即可）。
 */
const PORT = Number(process.env.E2E_PORT ?? 3123);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  // 准入开启态由 playwright.gate.config.ts 独立执行；这里跑关闭态与全部业务测试。
  testIgnore: "**/webgpu-gate.spec.ts",
  outputDir: "e2e/.results",
  // 缺基线也必须报错，不把一次测试产生的图片悄悄变成下一次的“已批准”基线。
  updateSnapshots: "none",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL,
    locale: "zh-CN",
    // 与站点固定时区不同，顺带验证日期渲染不会水合不一致
    timezoneId: "America/New_York",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // 没法下载浏览器的环境可指定本机 Chromium
        launchOptions: { executablePath: process.env.E2E_CHROMIUM_PATH || undefined },
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "node build/server/index.js",
        url: `${baseURL}/robots.txt`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        env: { ...process.env, PORT: String(PORT), DISABLE_SCHEDULERS: "1" } as Record<
          string,
          string
        >,
      },
});
