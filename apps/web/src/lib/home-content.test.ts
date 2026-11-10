import { ORPCError } from "@orpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isDegraded, withRequestState } from "./degrade.server";

// 只替换数据库／会话边界；执行真实 loader 与请求级降级标记。
const api = vi.hoisted(() => {
  const list = () => vi.fn<() => Promise<unknown[]>>().mockResolvedValue([]);
  return {
    blog: { list: list() },
    moments: { list: list() },
    project: { list: list() },
    music: { list: list() },
    movie: { list: list() },
    vn: { list: list() },
    gallery: { page: vi.fn().mockResolvedValue({ items: [] }) },
    maimai: {
      profile: vi.fn().mockResolvedValue(null),
      b50: vi.fn().mockResolvedValue({ b35: [], b15: [] }),
    },
  };
});
vi.mock("./orpc/api.server", () => ({ serverApi: () => api }));

import { loader } from "@/routes/site/home";

const args = () =>
  ({ request: new Request("http://localhost/"), params: {}, context: {} }) as Parameters<
    typeof loader
  >[0];
const post = (slug: string, status = "published") => ({
  id: slug,
  slug,
  status,
  title: `文章 ${slug}`,
  excerpt: "真实摘要",
  publishedAt: new Date("2026-11-01T00:00:00Z"),
  createdAt: new Date("2026-11-01T00:00:00Z"),
});

beforeEach(() => {
  for (const group of [api.blog, api.moments, api.project])
    group.list.mockReset().mockResolvedValue([]);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("首页的真实读取结果", () => {
  it("先过滤草稿再取前三篇，并保留公开原文与输入顺序", async () => {
    const original = [post("draft", "draft"), post("a"), post("b"), post("c"), post("d")];
    const before = structuredClone(original);
    api.blog.list.mockResolvedValue(original);
    const result = await loader(args());
    expect(result.posts).toEqual({
      status: "ready",
      items: [original[1], original[2], original[3]],
    });
    expect(original).toEqual(before);
    expect(JSON.stringify(result)).not.toContain('"slug":"draft"');
  });

  it("说说与作品分别取两项，不修改或凑满原始记录", async () => {
    const moments = [1, 2, 3, 4].map((id) => ({ id, content: `近况 ${id}` }));
    const projects = [1, 2, 3].map((id) => ({ id, name: `作品 ${id}`, description: "原说明" }));
    api.moments.list.mockResolvedValue(moments);
    api.project.list.mockResolvedValue(projects);
    const result = await loader(args());
    expect(result.moments).toEqual({ status: "ready", items: moments.slice(0, 2) });
    expect(result.projects).toEqual({ status: "ready", items: projects.slice(0, 2) });
    expect(moments).toHaveLength(4);
    expect(projects).toHaveLength(3);
  });

  it("真实空数据是成功为空，不是请求失败", async () => {
    const result = await withRequestState(async () => ({
      result: await loader(args()),
      degraded: isDegraded(),
    }));
    expect(result.result).toEqual({
      posts: { status: "ready", items: [] },
      moments: { status: "ready", items: [] },
      projects: { status: "ready", items: [] },
    });
    expect(result.degraded).toBe(false);
  });

  it("单模块故障保留成功文章，并保留故障响应不缓存的标记", async () => {
    api.blog.list.mockResolvedValue([post("available")]);
    api.moments.list.mockRejectedValue(new Error("secret-db-connection"));
    api.project.list.mockResolvedValue([{ id: 1, name: "WVN", description: "现有说明" }]);
    const { result, degraded } = await withRequestState(async () => ({
      result: await loader(args()),
      degraded: isDegraded(),
    }));
    expect(result.posts).toEqual({ status: "ready", items: [post("available")] });
    expect(result.moments).toEqual({ status: "error", items: [] });
    expect(result.projects).toEqual({
      status: "ready",
      items: [{ id: 1, name: "WVN", description: "现有说明" }],
    });
    expect(degraded).toBe(true);
    expect(JSON.stringify(result)).not.toContain("secret-db-connection");
  });

  it("正常 NOT_FOUND 沿用空结果约定，不污染降级缓存标记", async () => {
    api.project.list.mockRejectedValue(new ORPCError("NOT_FOUND"));
    const { result, degraded } = await withRequestState(async () => ({
      result: await loader(args()),
      degraded: isDegraded(),
    }));
    expect(result.projects).toEqual({ status: "ready", items: [] });
    expect(degraded).toBe(false);
  });

  it("鉴权失败不是成功空数据，也不会向页面透传内部异常", async () => {
    api.blog.list.mockRejectedValue(new ORPCError("FORBIDDEN", { message: "internal-policy" }));
    const { result, degraded } = await withRequestState(async () => ({
      result: await loader(args()),
      degraded: isDegraded(),
    }));
    expect(result.posts).toEqual({ status: "error", items: [] });
    expect(degraded).toBe(true);
    expect(JSON.stringify(result)).not.toContain("internal-policy");
  });
});
