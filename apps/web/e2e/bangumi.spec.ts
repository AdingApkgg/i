import { expect, test } from "./fixtures";

test("番剧页提供独立入口和可用的空状态", async ({ page }) => {
  const response = await page.goto("/anime");
  expect(response?.headers()["cache-control"]).toContain("no-store");
  await expect(page.getByRole("heading", { name: "番剧", exact: true })).toBeVisible();
  await expect(
    page.getByRole("navigation").first().getByRole("link", { name: "番剧", exact: true }),
  ).toBeVisible();
});

test.describe("Bangumi 双向同步", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });
  test("首次预览零写入，确认后双向同步、逐集标记和冲突选择，私有记录不公开", async ({
    page,
    request,
  }, testInfo) => {
    test.skip(!process.env.BANGUMI_FIXTURE_URL, "需要 CI 专用服务端 Bangumi 替身");
    test.setTimeout(120000);
    page.setDefaultTimeout(10000);
    const { default: pg } = await import("pg");
    const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    const fixture = process.env.BANGUMI_FIXTURE_URL!;
    const control = async (path: string, data?: unknown) => {
      const response =
        data === undefined
          ? await request.get(`${fixture}${path}`)
          : await request.post(`${fixture}${path}`, { data });
      expect(response.ok()).toBe(true);
      return response.json();
    };
    const record = async () =>
      (await db.query('SELECT * FROM "BangumiEntry" WHERE "subjectId"=7001')).rows[0];
    const idle = async () => {
      await expect
        .poll(
          async () =>
            (await db.query('SELECT "activeRunId" FROM "BangumiAccount" WHERE id=\'current\''))
              .rows[0]?.activeRunId,
          { timeout: 30000 },
        )
        .toBeNull();
    };
    async function clean() {
      const account = (await db.query('SELECT "userId" FROM "BangumiAccount" WHERE id=\'current\''))
        .rows[0];
      if (account && account.userId !== 999)
        throw new Error("Refusing to reset a non-fixture Bangumi account");
      const rows = (await db.query('SELECT "subjectId" FROM "BangumiEntry"')).rows;
      if (rows.some((r) => ![7001, 7002, 7003].includes(r.subjectId)))
        throw new Error("Refusing to reset non-fixture anime");
      const ids = (await db.query('SELECT id FROM "BangumiRun"')).rows.map((r) => r.id);
      if (!account && ids.length) throw new Error("Refusing to reset unidentified sync runs");
      await db.query('DELETE FROM "BangumiEntry" WHERE "subjectId" = ANY($1)', [
        [7001, 7002, 7003],
      ]);
      await db.query('DELETE FROM "BangumiRun" WHERE id = ANY($1)', [ids]);
      await db.query('DELETE FROM "BangumiAccount" WHERE "userId" = 999');
    }
    try {
      await clean();
      await control("/reset", {});
      await page.goto("/dash/anime");
      await expect(page.getByText("首次同步尚未确认，当前不会自动推送追番记录。")).toBeVisible();
      await page.getByRole("button", { name: "演练预览", exact: true }).click();
      await expect(page.getByRole("heading", { name: "首次／手动演练预览" })).toBeVisible({
        timeout: 20000,
      });
      expect((await control("/state")).writes).toHaveLength(0);
      expect((await db.query('SELECT count(*)::int AS n FROM "BangumiEntry"')).rows[0].n).toBe(0);
      await page.screenshot({ path: testInfo.outputPath("bangumi-preview.png"), fullPage: true });
      await page.getByRole("button", { name: "确认应用此预览" }).click();
      await expect(page.getByText("同步完成", { exact: true })).toBeVisible({ timeout: 20000 });
      await idle();
      await expect(page.getByRole("button", { name: "编辑 星空的约定" })).toBeVisible();
      expect((await control("/state")).writes).toHaveLength(0);
      await page.goto("/anime");
      await expect(page.getByRole("article", { name: "星空的约定" })).toBeVisible();
      await expect(page.getByText("私有测试番剧")).toHaveCount(0);
      const html = await (await request.get("/anime")).text();
      expect(html).not.toContain("不应公开的私有短评");
      expect(html).not.toContain("e2e-bangumi-token");
      await page.goto("/dash/anime");
      await page.getByRole("button", { name: "编辑 星空的约定" }).click();
      const editor = page.getByRole("form", { name: "编辑番剧" });
      await editor.getByLabel("追番状态").selectOption("2");
      await editor.getByLabel("个人评分").fill("8");
      await editor.getByRole("textbox", { name: "短评", exact: true }).fill("本站写入短评");
      await editor.getByLabel("章节 2：第二集", { exact: true }).selectOption("2");
      await editor.getByLabel("章节 2.5：特别篇").selectOption("3");
      await editor.getByRole("button", { name: "保存追番记录" }).click();
      await expect
        .poll(async () => (await record())?.baseline?.comment, { timeout: 20000 })
        .toBe("本站写入短评");
      await idle();
      let state = (await control("/state")).rows.find(
        (r: { subject_id: number }) => r.subject_id === 7001,
      );
      expect(state).toMatchObject({
        type: 2,
        rate: 8,
        comment: "本站写入短评",
        episodes: { "700102": 2, "700105": 3 },
      });
      expect(state.tags).toEqual(["保留标签"]);
      // 不刷新页面连续编辑，自动同步完成后必须使用最新 revision。
      await expect(page.getByRole("button", { name: "编辑 星空的约定" })).toBeEnabled();
      await page.getByRole("button", { name: "编辑 星空的约定" }).click();
      await editor.getByLabel("个人评分").fill("7");
      await editor.getByRole("button", { name: "保存追番记录" }).click();
      await expect.poll(async () => (await record()).baseline?.rate, { timeout: 20000 }).toBe(7);
      await idle();

      await control("/change", {
        subjectId: 7001,
        state: { rate: 9, comment: "Bangumi 新短评", episodes: { "700101": 0 } },
      });
      await expect(page.getByRole("button", { name: "立即同步", exact: true })).toBeEnabled();
      await page.getByRole("button", { name: "立即同步", exact: true }).click();
      await expect
        .poll(async () => (await record()).state.comment, { timeout: 20000 })
        .toBe("Bangumi 新短评");
      await idle();
      expect((await record()).state.episodes["700101"]).toBe(0);
      // 双方同字段分别编辑，普通同步不得覆盖。
      await control("/change", { subjectId: 7001, state: { comment: "Bangumi 冲突短评" } });
      await expect(page.getByRole("button", { name: "编辑 星空的约定" })).toBeEnabled();
      await page.getByRole("button", { name: "编辑 星空的约定" }).click();
      await editor.getByRole("textbox", { name: "短评", exact: true }).fill("本站冲突短评");
      await editor.getByRole("button", { name: "保存追番记录" }).click();
      await expect
        .poll(async () => (await record()).syncStatus, { timeout: 20000 })
        .toBe("conflict");
      await idle();
      await page.getByRole("button", { name: "演练预览", exact: true }).click();
      const choice = page.getByRole("combobox", { name: "7001 短评 冲突选择" });
      await expect(choice).toBeVisible({ timeout: 20000 });
      await expect(page.getByRole("button", { name: "确认应用此预览" })).toBeDisabled();
      await page.screenshot({ path: testInfo.outputPath("bangumi-conflict.png"), fullPage: true });
      await choice.selectOption("local");
      await page.getByRole("button", { name: "确认应用此预览" }).click();
      await expect
        .poll(async () => (await record()).baseline.comment, { timeout: 20000 })
        .toBe("本站冲突短评");
      await idle();
      state = (await control("/state")).rows.find(
        (r: { subject_id: number }) => r.subject_id === 7001,
      );
      expect(state.comment).toBe("本站冲突短评");
      // 上游写入结果不确定时保留完整目标，重新演练必须明确确认恢复。
      await control("/fail", { enabled: true });
      await expect(page.getByRole("button", { name: "编辑 星空的约定" })).toBeEnabled();
      await page.getByRole("button", { name: "编辑 星空的约定" }).click();
      await editor.getByRole("textbox", { name: "短评", exact: true }).fill("失败后仍保留的短评");
      await editor.getByRole("button", { name: "保存追番记录" }).click();
      await expect.poll(async () => (await record()).syncStatus, { timeout: 20000 }).toBe("error");
      await idle();
      expect((await record()).state.comment).toBe("失败后仍保留的短评");
      await control("/fail", { enabled: false });
      await page.getByRole("button", { name: "演练预览", exact: true }).click();
      const recovery = page.getByRole("combobox", { name: "7001 上次写入结果未确认 冲突选择" });
      await expect(recovery).toBeVisible({ timeout: 20000 });
      await recovery.selectOption("local");
      await page.getByRole("button", { name: "确认应用此预览" }).click();
      await expect
        .poll(async () => (await record()).baseline.comment, { timeout: 20000 })
        .toBe("失败后仍保留的短评");
      await idle();
      // 连续添加后不打开过期编辑器，完成同步再从最新列表编辑。
      await page.getByRole("textbox", { name: "添加番剧", exact: true }).fill("7003");
      await page.getByRole("button", { name: "添加追番", exact: true }).click();
      await expect
        .poll(
          async () =>
            (await db.query('SELECT "syncStatus" FROM "BangumiEntry" WHERE "subjectId"=7003'))
              .rows[0]?.syncStatus,
          { timeout: 20000 },
        )
        .toBe("synced");
      await idle();
      await expect(page.getByRole("form", { name: "编辑番剧" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "编辑 测试新增番剧" })).toBeEnabled();
      await page.getByRole("button", { name: "编辑 测试新增番剧" }).click();
      await editor.getByRole("textbox", { name: "短评", exact: true }).fill("新增后编辑不丢失");
      await editor.getByRole("button", { name: "保存追番记录" }).click();
      await expect
        .poll(
          async () =>
            (await db.query('SELECT "baseline" FROM "BangumiEntry" WHERE "subjectId"=7003')).rows[0]
              ?.baseline?.comment,
          { timeout: 20000 },
        )
        .toBe("新增后编辑不丢失");
      await idle();
      await page.goto("/anime");
      await expect(page.getByText("失败后仍保留的短评")).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("bangumi-public.png"), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: testInfo.outputPath("bangumi-mobile.png"), fullPage: true });
    } finally {
      const active = (
        await db.query('SELECT "activeRunId" FROM "BangumiAccount" WHERE id=\'current\'')
      ).rows[0]?.activeRunId;
      if (active) await idle();
      await clean();
      await db.end();
    }
  });
});
