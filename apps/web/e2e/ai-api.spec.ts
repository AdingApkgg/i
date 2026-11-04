/**
 * AI 管理面：OpenAPI 文档 + MCP 端点 + token 权限边界。
 *
 * token 都走后台真实接口签发（cookie 登录态），不直接写库 —— 顺带覆盖签发路径。
 */
import { expect, request as pwRequest, test } from "@playwright/test";
import { ADMIN, ADMIN_STATE } from "./fixtures";

type Token = { id: string; secret: string };

test.describe("AI 管理面", () => {
  test.use({ storageState: ADMIN_STATE });

  const minted: Token[] = [];

  // 用例结束统一吊销并删除，免得 token 一路累积到 20 个上限
  test.afterAll(async ({ request: _ignored }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL;
    const admin = await pwRequest.newContext({ baseURL, storageState: ADMIN_STATE });
    for (const token of minted) {
      await admin.post("/api/rpc/apiToken/revoke", { data: { json: { id: token.id } } });
      await admin.post("/api/rpc/apiToken/remove", { data: { json: { id: token.id } } });
    }
    await admin.dispose();
  });

  /** 用后台登录态签发一个 token，返回明文 secret（只在 create 响应里出现一次） */
  async function mint(
    request: import("@playwright/test").APIRequestContext,
    scope: "read" | "write",
  ): Promise<Token> {
    const res = await request.post("/api/rpc/apiToken/create", {
      data: { json: { name: `e2e-${scope}-${Date.now()}`, scope } },
    });
    expect(res.status(), await res.text()).toBe(200);
    const body = await res.json();
    const token = { id: body.json.token.id as string, secret: body.json.secret as string };
    minted.push(token);
    return token;
  }

  test("OpenAPI 文档公开可读，只暴露白名单分组", async ({ request }) => {
    const res = await request.get("/api/openapi.json");
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toContain("max-age=300");

    const doc = await res.json();
    expect(doc.servers).toEqual([{ url: "/api/rpc" }]);
    const paths = Object.keys(doc.paths);
    expect(paths).toContain("/blog/list");
    expect(paths).toContain("/device/create");
    // 白名单之外的分组（health/vndb 等）不出现
    expect(paths.some((p) => p.startsWith("/health"))).toBe(false);
    expect(paths.some((p) => p.startsWith("/vndb"))).toBe(false);

    // 每个操作都要求 bearer
    const op = doc.paths["/blog/list"].post;
    expect(op.security).toEqual([{ bearer: [] }]);
    expect(typeof op.operationId).toBe("string");
  });

  test("MCP 只吃 POST，未鉴权 401", async ({ baseURL, page }) => {
    // 裸 request context 不带 cookie，才是真正的未登录
    const anonymous = await pwRequest.newContext({ baseURL });
    // newContext 会带上项目默认 storageState（use.storageState），先清掉才是未登录
    await anonymous.clearCookies();
    const res = await anonymous.post("/api/mcp", { data: { jsonrpc: "2.0", id: 1 } });
    expect(res.status()).toBe(401);
    const getRes = await anonymous.get("/api/mcp");
    expect(getRes.status()).toBe(401);
    await anonymous.dispose();

    await page.goto("/dash");
    const token = await mint(page.request, "read");
    const headers = { authorization: `Bearer ${token.secret}` };

    const get = await page.request.get("/api/mcp", { headers });
    expect(get.status()).toBe(405);
    expect(get.headers().allow).toBe("POST");
  });

  test("read token 看不到也打不动写接口", async ({ page }) => {
    await page.goto("/dash");
    const token = await mint(page.request, "read");
    const headers = { authorization: `Bearer ${token.secret}`, "content-type": "application/json" };
    const rpc = async (body: unknown) => {
      const res = await page.request.post("/api/mcp", { headers, data: body });
      expect(res.status()).toBe(200);
      return res.json();
    };

    const list = await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    const names: string[] = list.result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("blog_list");
    expect(names.some((n) => n.endsWith("_create"))).toBe(false);
    expect(names.some((n) => n.endsWith("_delete"))).toBe(false);

    const call = await rpc({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "device_create", arguments: { name: "mcp-probe", category: "phone" } },
    });
    expect(call.result.isError).toBe(true);
    expect(call.result.content[0].text).toContain("只读");
  });

  test("write token 能建能删，工具清单含写接口", async ({ page }) => {
    await page.goto("/dash");
    const token = await mint(page.request, "write");
    const headers = { authorization: `Bearer ${token.secret}`, "content-type": "application/json" };
    const rpc = async (body: unknown) => {
      const res = await page.request.post("/api/mcp", { headers, data: body });
      expect(res.status()).toBe(200);
      return res.json();
    };

    const list = await rpc({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    const names: string[] = list.result.tools.map((t: { name: string }) => t.name);
    expect(names).toContain("device_create");
    expect(names.length).toBeGreaterThan(50);

    const name = `mcp-probe-${Date.now()}`;
    const created = await rpc({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "device_create", arguments: { name, category: "phone" } },
    });
    expect(created.result.isError).toBeFalsy();
    const device = JSON.parse(created.result.content[0].text);
    expect(device.name).toBe(name);

    const removed = await rpc({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "device_delete", arguments: { id: device.id } },
    });
    expect(removed.result.isError).toBeFalsy();
  });

  test("未知工具名与坏 JSON 走 JSON-RPC 错误码", async ({ page }) => {
    await page.goto("/dash");
    const token = await mint(page.request, "read");
    const headers = { authorization: `Bearer ${token.secret}`, "content-type": "application/json" };

    const unknown = await page.request.post("/api/mcp", {
      headers,
      data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "nope_nope" } },
    });
    // 未知工具 = params 里的 name 不成立
    expect((await unknown.json()).error.code).toBe(-32602);

    const noMethod = await page.request.post("/api/mcp", {
      headers,
      data: { jsonrpc: "2.0", id: 2, method: "nope/nope" },
    });
    expect((await noMethod.json()).error.code).toBe(-32601);

    const broken = await page.request.post("/api/mcp", { headers, data: "" });
    expect((await broken.json()).error.code).toBe(-32700);
  });
});

test.describe("token 页", () => {
  test.use({ storageState: ADMIN_STATE });

  test("桌面上能签发并吊销", async ({ page }) => {
    await page.goto("/dash/tokens");
    await expect(page.getByRole("heading", { name: "AI 接入" })).toBeVisible();

    const name = `page-${Date.now()}`;
    await page.getByPlaceholder(/用途/).fill(name);
    await page.getByRole("button", { name: "签发" }).click();
    await expect(page.getByText("新 token（关掉就不再显示）")).toBeVisible();

    const row = page.locator("li", { hasText: name });
    await row.getByRole("button", { name: "撤销" }).click();
    await expect(page.getByText("已撤销")).toBeVisible();
    await expect(row).toHaveClass(/-/);
  });

  test("ADMIN 常量与登录态存在", async ({ page }) => {
    expect(ADMIN.email).toContain("@");
    await page.goto("/dash");
    await expect(page).toHaveURL(/\/dash/);
  });
});

test.describe("未登录", () => {
  test("token 列表 401", async ({ request }) => {
    const res = await request.post("/api/rpc/apiToken/list", { data: { json: {} } });
    expect(res.status()).toBe(401);
  });
});
