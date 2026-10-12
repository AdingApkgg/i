import { test as base, expect, type Locator, type Page } from "@playwright/test";

export const ADMIN = { name: "e2e", email: "e2e-admin@example.com", password: "e2e-admin-pass" };
export const ADMIN_STATE = "e2e/.auth/admin.json";

/**
 * 每个页面：
 * - 拦掉站外请求（seed 的示例封面、外部播放器等），测试不依赖外网、也更快；
 * - 收集控制台错误 / 警告和未捕获异常（含 React 水合不一致），用例结束时断言为空。
 */
export const test = base.extend<{ consoleProblems: string[]; showMascot: boolean }>({
  /** 看板娘固定在右下角，会挡住那里的按钮；默认用站点自带的“隐藏”开关收起，需要时 test.use 打开 */
  showMascot: [false, { option: true }],
  consoleProblems: [
    async ({ page, baseURL, showMascot }, use) => {
      if (!showMascot) {
        await page.addInitScript(() => localStorage.setItem("waifu.hidden", "1"));
      }
      const origin = new URL(baseURL!).origin;
      await page.route(
        (url) => url.origin !== origin,
        (route) => route.abort(),
      );
      const problems: string[] = [];
      page.on("console", (m) => {
        if (m.type() !== "error" && m.type() !== "warning") return;
        // 被拦掉的站外资源
        if (/Failed to load resource|ERR_FAILED/.test(m.text())) return;
        problems.push(`[${m.type()}] ${pathOf(page)}: ${m.text().slice(0, 300)}`);
      });
      page.on("pageerror", (e) => problems.push(`[pageerror] ${pathOf(page)}: ${e.message}`));
      await use(problems);
      expect(problems, "控制台错误 / 警告").toEqual([]);
    },
    { auto: true },
  ],
});

/** 离 el 最近、且包含 button 的祖先块（评论卡片、待审核友链卡片等） */
export const cardOf = (el: Locator, button: string) =>
  el.locator(
    `xpath=ancestor::div[.//button[normalize-space()='${button}' or @aria-label='${button}']][1]`,
  );

const pathOf = (page: Page) => {
  const u = new URL(page.url());
  return decodeURIComponent(u.pathname + u.search);
};

export { expect };
