import pg from "pg";
import { expect, test } from "./fixtures";
import { TOUHOU_ROWS } from "./fixtures/touhou";
import { navigateMain } from "./navigation-helpers";

const PAGES = [
  "/",
  "/blog",
  "/blog/hello-world",
  "/music",
  "/movie",
  "/vn",
  "/touhou",
  "/device",
  "/masturbation",
  "/gallery",
  "/gallery/旅行记录",
  "/moments",
  "/friends",
  "/monitor",
  "/maimai",
  "/about",
  "/design",
];

test.describe("前台页面（含看板娘）", () => {
  test.use({ showMascot: true });

  test("前台各页面服务端直出 200，水合后无报错", async ({ page }) => {
    // 十几页逐个直出，dev 首编译慢，放宽到三倍超时
    test.slow();
    for (const path of PAGES) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await page.waitForLoadState("networkidle");
    }
    await page.goto("/blog/hello-world");
    await expect(page.getByRole("heading", { name: "你好，世界", exact: true })).toBeVisible();
    await expect(page).toHaveTitle(/^你好，世界 ✿ · /);
  });
});

test("设备页按分类分组，卡片带状态徽章", async ({ page }) => {
  await page.goto("/device");
  const main = page.locator("main");
  // 分类分组标题按「电脑 → 手机」排序
  await expect(main.getByRole("heading", { name: "电脑", exact: true })).toBeVisible();
  await expect(main.getByRole("heading", { name: "手机", exact: true })).toBeVisible();
  // 每台设备一张卡，卡片上有名称、规格与在用徽章
  const cards = main.locator("h3");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBeGreaterThan(0);
  await expect(main.getByText("在用").first()).toBeVisible();
  await expect(main.getByText("共 ")).toBeVisible();
  // 手机宽度下不横向溢出
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBe(
    0,
  );
});

test("关于页：顶栏可达，行内剧透点开才显示", async ({ page }) => {
  await page.goto("/");
  // 桌面与手机导航各有一个「关于」入口，点桌面的那个
  await page.locator("header nav").getByRole("link", { name: "关于" }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/about$/);
  // 种子只放一条剧透，线上正文有多条，这里只要求至少一条可点；
  // 点开后按钮的可访问名会变，所以按位置而不是按文案定位
  const spoiler = page.locator("main button[aria-pressed]").first();
  await expect(spoiler).toBeVisible();
  await expect(spoiler).toHaveText("点此显示");
  // SSR 出来就能看到按钮，水合完成前点击是空点：这里点到达成为止
  for (let i = 0; i < 10; i++) {
    if ((await spoiler.getAttribute("aria-pressed")) === "true") break;
    await spoiler.click();
    await page.waitForTimeout(300);
  }
  // 点开后按钮显示被藏起来的正文，且带上按下态
  await expect(spoiler).toHaveAttribute("aria-pressed", "true");
  await expect(spoiler).not.toHaveText("点此显示");
  await expect(page.locator("main button[aria-pressed=true]")).toHaveCount(1);
});

test("不存在的页面：404、保留站点外壳、noindex", async ({ page }) => {
  const res = await page.goto("/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("这一页迷路了")).toBeVisible();
  await expect(page.locator("header nav")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
});

test("主导航走客户端路由，不整页刷新", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    (window as unknown as { __marker: number }).__marker = 42;
  });
  for (const [label, path, group] of [
    ["博客", "/blog", "日常"],
    ["相册", "/gallery", "日常"],
    ["友链", "/friends", undefined],
    ["说说", "/moments", "日常"],
    ["音乐", "/music", "收藏"],
  ] as const) {
    await navigateMain(page, label, group);
    await expect(page).toHaveURL(path);
  }
  expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(42);
});

test("客户端跳到 404 时播放器不重新挂载（音乐不中断）", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    document.querySelector("audio")!.dataset.mark = "same-element";
  });
  await page.evaluate(() => {
    history.pushState(null, "", "/no-such-page");
    dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByText("这一页迷路了")).toBeVisible();
  expect(await page.evaluate(() => document.querySelector("audio")?.dataset.mark)).toBe(
    "same-element",
  );
});

test("未登录访问后台跳到登录页", async ({ page }) => {
  await page.goto("/dash");
  await expect(page).toHaveURL(/\/dash\/login$/);
  await expect(page.getByText("登录后台")).toBeVisible();
});

test("友链申请：前端校验提示 → 提交成功", async ({ page }) => {
  // 每次换一个访客 IP（线上由 Cloudflare 写入 CF-Connecting-IP，Caddy 原样转发）和链接：
  // 申请按 IP 限频、按链接去重，反复跑也不受影响
  const run = Date.now();
  await page.setExtraHTTPHeaders({ "cf-connecting-ip": `198.51.100.${run % 250}` });
  await page.goto("/friends");
  await page.getByText("我要申请").click();
  await page.getByPlaceholder("站点名称 *").fill(`e2e 站点 ${run}`);
  await page.getByPlaceholder("站点链接 * https://…").fill(`https://e2e-${run}.example.org`);
  await page.getByPlaceholder(/邮箱/).fill("e2e@example.org");
  await page.getByPlaceholder("头像链接 https://…").fill("not a url");
  await page.getByRole("button", { name: "提交申请" }).click();
  await expect(page.getByText("头像链接格式不对～")).toBeVisible();

  await page.getByPlaceholder("头像链接 https://…").fill("");
  await page.getByRole("button", { name: "提交申请" }).click();
  await expect(page.getByText(/^已提交/)).toBeVisible();
});

test("访客注册：密码太短就地提示 → 注册成功后出现评论框", async ({ page }) => {
  await page.goto("/blog/hello-world");
  // SSR 出来的切换按钮在水合前点是空点：点到达成为止。
  // 切换成功后按钮会换成「已有账号？去登录」，所以每次点击都要限时并容错。
  for (let i = 0; i < 10; i++) {
    try {
      await page.getByText("没有账号？去注册").click({ timeout: 1500 });
    } catch {
      // 元素已被切换掉
    }
    if (await page.getByText("注册一个访客账号").count()) break;
    await page.waitForTimeout(300);
  }
  // 切换成功后再填，否则会填进登录表单
  await expect(page.getByText("注册一个访客账号")).toBeVisible();
  await page.getByPlaceholder("邮箱").fill(`visitor-${Date.now()}@example.org`);
  await page.getByPlaceholder("密码").fill("123");
  await page.getByRole("button", { name: "注册" }).click();
  // dev 下 auth 路由首编译会明显超出默认 5s
  await expect(page.getByText("密码至少 6 位")).toBeVisible({ timeout: 15_000 });

  await page.getByPlaceholder("密码").fill("visitor-pass");
  await page.getByRole("button", { name: "注册" }).click();
  await expect(page.getByPlaceholder(/的身份评论/)).toBeVisible();
});

test.describe("深色模式跟随系统（纯 CSS，不需要 JS）", () => {
  test.use({ javaScriptEnabled: false });

  test("prefers-color-scheme 切换背景色", async ({ page }) => {
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/");
    const light = await bg();
    await page.emulateMedia({ colorScheme: "dark" });
    const dark = await bg();
    expect(dark).not.toBe(light);
    await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute(
      "content",
      "light dark",
    );
  });
});

test("缓存头：前台页面可进 CDN，后台不进", async ({ request }) => {
  const home = await request.get("/");
  expect(home.headers()["cdn-cache-control"]).toContain("stale-while-revalidate");
  expect(home.headers()["cache-control"]).toContain("max-age=0");

  const dash = await request.get("/dash/login");
  expect(dash.headers()["cache-control"]).toBe("private, no-store");
  expect(dash.headers()["cdn-cache-control"]).toBeUndefined();
});

test("RSS / sitemap / robots / 分享卡片", async ({ request }) => {
  const rss = await request.get("/rss.xml");
  expect(rss.headers()["content-type"]).toContain("xml");
  expect(await rss.text()).toContain("你好，世界");

  const sitemap = await request.get("/sitemap.xml");
  const sitemapBody = await sitemap.text();
  expect(sitemapBody).toContain("/blog/hello-world");
  expect(sitemapBody).toContain("/about");

  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toContain("Sitemap:");

  const og = await request.get("/og/blog/hello-world.png");
  expect(og.headers()["content-type"]).toBe("image/png");
});

test.describe("东方作品列表", () => {
  // 用完整的 32 作自铺数据：CI 的种子库只放两部，比例和倒序都验不出来
  test.beforeAll(async () => {
    const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    try {
      await db.query('DELETE FROM "Touhou"');
      for (const row of TOUHOU_ROWS)
        await db.query(
          `INSERT INTO "Touhou" (id, title, code, "originalTitle", "releasedAt", category, status, "sortOrder", "coverUrl", "updatedAt")
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, now())`,
          [
            row.title,
            row.code,
            row.originalTitle,
            row.releasedAt,
            row.category,
            row.status,
            row.sortOrder,
            row.coverUrl,
          ],
        );
    } finally {
      await db.end();
    }
  });

  test("按首发日期倒序，封面按原比例不裁切且带编号、日期", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/touhou");
    // 封面是外链，等足够多的图解码完再量比例，否则量到的都是 0
    await page.waitForFunction(
      () =>
        [...document.querySelectorAll<HTMLImageElement>("main img")].filter(
          (img) => img.complete && img.naturalWidth > 0,
        ).length > 30,
      undefined,
      { timeout: 60_000 },
    );
    const titles = await page.locator("main h2").allInnerTexts();
    // 最新作排最前，越早越靠后
    expect(titles[0]).toBe("东方锦上京");
    expect(titles.indexOf("东方妖妖梦")).toBeGreaterThanOrEqual(0);
    expect(titles.indexOf("东方妖妖梦")).toBeLessThan(titles.indexOf("东方红魔乡"));

    await expect(page.getByText("2003.08.17")).toBeVisible();
    await expect(page.getByText("TH07").first()).toBeVisible();

    // 不裁切：渲染宽高比必须跟原图一致（容差 2%）
    const ratios = await page.locator("main img").evaluateAll((els) =>
      els
        .map((e) => e as HTMLImageElement)
        .filter((img) => img.naturalWidth > 0 && img.clientHeight > 0)
        .map(
          (img) =>
            [img.clientWidth / img.clientHeight, img.naturalWidth / img.naturalHeight] as const,
        ),
    );
    expect(ratios.length).toBeGreaterThan(30);
    for (const [rendered, natural] of ratios) {
      expect(Math.abs(rendered - natural) / natural).toBeLessThan(0.02);
    }

    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(over).toBe(0);
  });
});
