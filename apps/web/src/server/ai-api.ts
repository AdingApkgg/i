/**
 * 给 AI 用的管理面：一份 OpenAPI 描述 + 一个最小 MCP（JSON-RPC over HTTP）端点。
 *
 * 两者同源：MCP 的 tools/list 直接从 OpenAPI 文档派生，所以路由、zod 校验、
 * 错误码只有一套真相，改 router 就同时改了两边。调用走 in-process 的
 * createRouterClient，中间件（admin / 只读 token）照常生效。
 */

import { OpenAPIGenerator, type OpenAPIOperationObject } from "@orpc/openapi";
import { createRouterClient, ORPCError } from "@orpc/server";
import type { Context } from "./orpc";
import { router } from "./router";

/** 暴露给 AI 的路由分组；其余（health、vndb 搜索等）留在 RPC 里给页面自己用 */
const GROUPS = new Set([
  "blog",
  "page",
  "moments",
  "music",
  "movie",
  "vn",
  "touhou",
  "device",
  "albums",
  "gallery",
  "friends",
  "comment",
  "media",
  "dashStats",
  "bangumi",
  "dailyRecord",
  "apiToken",
]);

const SPEC_TTL_MS = 300_000;
const generator = new OpenAPIGenerator({});
let specCache: { at: number; doc: Record<string, unknown> } | null = null;

const isOperation = (key: string, value: unknown) =>
  !["parameters", "summary", "description", "servers"].includes(key) &&
  typeof value === "object" &&
  value !== null;

/** 只需要一次的规范化：每个操作都标 bearer，路径去掉 /api/rpc 前缀由 servers 承担 */
async function buildSpec() {
  const doc = (await generator.generate(router, {
    info: {
      title: "i 站管理 API",
      version: "1",
      description: [
        "个人站后台全部管理动作。鉴权：`Authorization: Bearer <token>`（后台 /dash/tokens 创建）。",
        "输入输出都是 JSON POST，路径前缀 `/api/rpc`。只读 token 打写接口会返回 403。",
        "上传图片先 POST /api/gallery/upload（multipart `file`），拿到 `imageUrl` 再写进记录的封面字段。",
      ].join("\n\n"),
    },
    servers: [{ url: "/api/rpc" }],
  })) as Record<string, unknown>;

  const paths = (doc.paths ?? {}) as Record<string, Record<string, OpenAPIOperationObject>>;
  for (const [path, item] of Object.entries(paths)) {
    if (!GROUPS.has(path.split("/")[1] ?? "")) {
      delete paths[path];
      continue;
    }
    for (const [key, op] of Object.entries(item)) {
      if (isOperation(key, op)) op.security = [{ bearer: [] }];
    }
  }
  doc.components = {
    ...((doc.components as object) ?? {}),
    securitySchemes: { bearer: { type: "http", scheme: "bearer" } },
  };
  return doc;
}

export async function openApiDocument() {
  if (specCache && Date.now() - specCache.at < SPEC_TTL_MS) return specCache.doc;
  const doc = await buildSpec();
  specCache = { at: Date.now(), doc };
  return doc;
}

/** 读动作白名单；不在里面的一律当写，只读 token 时从 tools/list 里藏掉 */
const READ_METHODS = new Set([
  "list",
  "detail",
  "byId",
  "stats",
  "overview",
  "config",
  "settings",
  "search",
  "adminList",
  "timeline",
]);

type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  read: boolean;
  group: string;
  method: string;
};

/** 工具名 = 分组_方法；写操作靠 procedure 是否 writeProcedure 区分不了，改用 scope 过滤 */
function toolsFrom(doc: Record<string, unknown>): Tool[] {
  const paths = (doc.paths ?? {}) as Record<string, Record<string, OpenAPIOperationObject>>;
  const tools: Tool[] = [];
  for (const [path, item] of Object.entries(paths)) {
    const [, group, method] = path.split("/");
    for (const [key, op] of Object.entries(item)) {
      if (!isOperation(key, op)) continue;
      const body = op.requestBody?.content?.["application/json"]?.schema as
        | Record<string, unknown>
        | undefined;
      tools.push({
        name: `${group}_${method}`,
        description: [op.summary, op.description].filter(Boolean).join(" — ") || path,
        inputSchema: body ?? { type: "object", properties: {}, additionalProperties: false },
        read: READ_METHODS.has(method!),
        group: group!,
        method: method!,
      });
    }
  }
  return tools.sort((a, b) => a.name.localeCompare(b.name));
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const rpcError = (id: unknown, code: number, message: string, data?: unknown) =>
  json({ jsonrpc: "2.0", id, error: { code, message, ...(data === undefined ? {} : { data }) } });

async function callTool(context: Context, tool: Tool, args: Record<string, unknown>) {
  const client = createRouterClient(router, { context }) as unknown as Record<
    string,
    Record<string, (input: unknown) => Promise<unknown>>
  >;
  const procedure = client[tool.group]?.[tool.method];
  if (!procedure) throw new ORPCError("NOT_FOUND", { message: `没有工具 ${tool.name}` });
  return procedure(args);
}

/** 单个 JSON-RPC 消息 */
async function dispatch(
  context: Context,
  message: Record<string, unknown>,
  doc: Record<string, unknown>,
) {
  const { id = null, method } = message;
  const params = (message.params ?? {}) as Record<string, unknown>;

  if (method === "initialize") {
    return json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "i-admin", version: "1" },
        instructions: [
          "i 站后台管理接口。先 tools/list 看能做什么，工具名形如 <分组>_<动作>。",
          "写之前先读（list/detail/overview），改完再读一次确认。",
          "图片用 media 分组或 POST /api/gallery/upload 处理，别手拼 CAS key。",
        ].join("\n"),
      },
    });
  }

  if (method === "tools/list") {
    const all = toolsFrom(doc);
    const tools = context.token?.scope === "read" ? all.filter((t) => t.read) : all;
    return json({ jsonrpc: "2.0", id, result: { tools } });
  }

  if (method === "tools/call") {
    const name = String(params.name ?? "");
    const tool = toolsFrom(doc).find((t) => t.name === name);
    if (!tool) return rpcError(id, -32602, `没有工具 ${name}`);
    try {
      const result = await callTool(
        context,
        tool,
        (params.arguments ?? {}) as Record<string, unknown>,
      );
      return json({
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: JSON.stringify(result ?? null) }] },
      });
    } catch (error) {
      const message = error instanceof ORPCError ? error.message : String(error);
      return json({
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: message }], isError: true },
      });
    }
  }

  if (String(method).startsWith("notifications/")) return new Response(null, { status: 202 });
  if (method === "ping") return json({ jsonrpc: "2.0", id, result: {} });
  return rpcError(id, -32601, `不支持的方法 ${String(method)}`);
}

export async function mcpResponse(context: Context, request: Request) {
  if (request.method !== "POST") {
    return new Response("method not allowed", { status: 405, headers: { allow: "POST" } });
  }
  const body = (await request.json().catch(() => null)) as unknown;
  if (!body) return rpcError(null, -32700, "解析不了 JSON");
  const doc = await openApiDocument();
  const messages = Array.isArray(body) ? body : [body];
  const results: Response[] = [];
  for (const message of messages) {
    if (typeof message !== "object" || message === null) {
      results.push(rpcError(null, -32600, "无效请求"));
      continue;
    }
    results.push(await dispatch(context, message as Record<string, unknown>, doc));
  }
  if (results.length === 1) return results[0]!;
  return json(await Promise.all(results.map((r) => (r.status === 202 ? null : r.json()))));
}
