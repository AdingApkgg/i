import { describe, expect, it } from "vitest";
import { BangumiClient } from "./api.server";
import type { CollectionState } from "./types";

const state: CollectionState = {
  type: 3,
  rate: 0,
  comment: "",
  private: true,
  episodes: { "10": 0, "11": 2 },
};
function upstream() {
  let current = structuredClone(state),
    writes = 0;
  const requests: { path: string; body: Record<string, unknown> }[] = [];
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    expect(url.origin).toBe("https://api.bgm.tv");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer secret-only-server");
    expect(new Headers(init?.headers).get("user-agent")).toContain("AdingApkgg/i");
    const path = url.pathname,
      method = init?.method ?? "GET";
    if (method !== "GET") {
      writes++;
      const body = JSON.parse(String(init?.body));
      requests.push({ path, body });
      if (path.endsWith("/episodes"))
        for (const id of body.episode_id) current.episodes[String(id)] = body.type;
      else {
        Object.assign(current, body);
        if (body.type === 2) current.episodes = { "10": 2, "11": 2 };
      }
      return new Response(null, { status: 204 });
    }
    if (path === "/v0/me") return Response.json({ id: 7, username: "owner", nickname: "测试" });
    if (path === "/v0/subjects/8")
      return Response.json({
        id: 8,
        type: 2,
        name: "Anime",
        name_cn: "番剧",
        images: { common: "https://lain.bgm.tv/a.jpg" },
        date: "2024-01-01",
        eps: 2,
        rating: { score: 8.5 },
      });
    if (path === "/v0/episodes")
      return Response.json({
        total: 2,
        limit: 100,
        offset: 0,
        data: [10, 11].map((id, i) => ({ id, subject_id: 8, sort: i + 1, name: "", type: 0 })),
      });
    if (path.endsWith("/episodes"))
      return Response.json({
        total: 2,
        limit: 100,
        offset: 0,
        data: [10, 11].map((id, i) => ({
          type: current.episodes[id],
          episode: { id, subject_id: 8, sort: i + 1, name: "", type: 0 },
        })),
      });
    const row = { subject_id: 8, subject_type: 2, ...current, tags: ["不改这个标签"] };
    if (path.endsWith("/collections/8")) return Response.json(row);
    return Response.json({ total: 1, limit: 100, offset: 0, data: [row] });
  };
  return { fetcher, read: () => current, writes: () => writes, requests };
}
describe("Bangumi API 边界", () => {
  it("只读快照分页读取真实章节 ID，私有记录保留属性但不执行写入", async () => {
    const api = upstream();
    const client = new BangumiClient("secret-only-server", {
      fetch: api.fetcher,
      wait: async () => {},
    });
    expect(await client.snapshot()).toEqual([
      {
        subjectId: 8,
        metadata: {
          id: 8,
          name: "Anime",
          nameCn: "番剧",
          image: "https://lain.bgm.tv/a.jpg",
          date: "2024-01-01",
          eps: 2,
          score: 8.5,
          episodes: [
            { id: 10, sort: 1, name: "", type: 0 },
            { id: 11, sort: 2, name: "", type: 0 },
          ],
        },
        state,
      },
    ]);
    expect(api.writes()).toBe(0);
  });
  it("只发修改字段，逐集状态用章节接口；状态看过引发上游批量标记后恢复明确的逐集选择", async () => {
    const api = upstream(),
      client = new BangumiClient("secret-only-server", {
        fetch: api.fetcher,
        wait: async () => {},
      });
    await client.write(8, state, {
      ...state,
      type: 2,
      rate: 9,
      comment: "好看",
      episodes: { "10": 0, "11": 3 },
    });
    expect(api.read()).toEqual({
      ...state,
      type: 2,
      rate: 9,
      comment: "好看",
      episodes: { "10": 0, "11": 3 },
    });
    expect(api.requests[0]).toEqual({
      path: "/v0/users/-/collections/8",
      body: { type: 2, rate: 9, comment: "好看" },
    });
    expect(api.requests.every((r) => !("ep_status" in r.body) && !("tags" in r.body))).toBe(true);
  });
  it("分页中断不能被解释为完整的空收藏", async () => {
    const client = new BangumiClient("hidden-token", {
      wait: async () => {},
      fetch: async (url) => {
        if (String(url).endsWith("/me")) return Response.json({ id: 7, username: "owner" });
        if (new URL(String(url)).searchParams.get("offset") === "0")
          return Response.json({
            total: 2,
            limit: 1,
            offset: 0,
            data: [
              { subject_id: 8, subject_type: 2, type: 3, rate: 0, comment: "", private: false },
            ],
          });
        return new Response("upstream secret hidden-token", { status: 503 });
      },
    });
    await expect(client.snapshot()).rejects.toThrow(/503/);
  });
  it("限流有界重试，鉴权错误不把 token 或响应体写进异常", async () => {
    let calls = 0;
    const client = new BangumiClient("hidden-token", {
      wait: async () => {},
      fetch: async () =>
        ++calls === 1
          ? new Response(null, { status: 429, headers: { "retry-after": "0" } })
          : Response.json({ id: 7, username: "owner" }),
    });
    expect((await client.me()).id).toBe(7);
    const denied = new BangumiClient("hidden-token", {
      fetch: async () => new Response("hidden-token private response", { status: 401 }),
    });
    await expect(denied.me()).rejects.toThrow(/401/);
    try {
      await denied.me();
    } catch (e) {
      expect(String(e)).not.toContain("hidden-token");
    }
  });
  it("损坏的分页响应拒绝继续，不能误判取消收藏", async () => {
    const client = new BangumiClient("x", {
      wait: async () => {},
      fetch: async (url) =>
        Response.json(
          String(url).endsWith("/me") ? { id: 7, username: "owner" } : { total: 10, data: [] },
        ),
    });
    await expect(client.snapshot()).rejects.toThrow(/分页/);
  });
});

describe("大收藏的确认扫描成本", () => {
  it("600部收藏的扫描与逐部复核不重复下载元数据，固定等待总量低于单任务时限", async () => {
    let waited = 0;
    const ids = Array.from({ length: 600 }, (_, i) => i + 1);
    const api = new BangumiClient("test", {
      wait: async (ms) => {
        waited += ms;
      },
      fetch: async (input) => {
        const u = new URL(String(input)),
          id = Number(u.pathname.split("/").at(-1));
        if (u.pathname === "/v0/me") return Response.json({ id: 1, username: "large" });
        if (u.pathname === "/v0/users/large/collections") {
          const offset = Number(u.searchParams.get("offset"));
          return Response.json({
            total: 600,
            offset,
            limit: 100,
            data: ids
              .slice(offset, offset + 100)
              .map((subject_id) => ({ subject_id, subject_type: 2, ...state })),
          });
        }
        if (u.pathname.startsWith("/v0/subjects/"))
          return Response.json({ id, type: 2, name: "Test", name_cn: "测试", eps: 0 });
        if (u.pathname.endsWith("/episodes"))
          return Response.json({ total: 0, offset: 0, limit: 100, data: [] });
        return Response.json({ subject_id: id, subject_type: 2, ...state });
      },
    });
    await api.snapshot();
    for (const id of ids) await api.entry(id);
    expect(waited).toBeLessThan(15 * 60 * 1000);
  });
});

describe("Bangumi 响应读取重试", () => {
  it("响应头已到但正文网络中断时重新读取，不能误报数据损坏", async () => {
    let calls = 0;
    const client = new BangumiClient("private-token", {
      wait: async () => {},
      fetch: async () => {
        if (++calls === 1)
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.error(new DOMException("body timed out", "TimeoutError"));
              },
            }),
          );
        return Response.json({ id: 7, username: "owner" });
      },
    });
    expect((await client.me()).id).toBe(7);
    expect(calls).toBe(2);
  });
  it("重复断连后错误包含失败方法和接口，不泄露原异常与 token", async () => {
    const client = new BangumiClient("private-token", {
      wait: async () => {},
      fetch: async () => {
        throw new TypeError("secret private-token");
      },
    });
    await expect(client.me()).rejects.toThrow(/GET \/v0\/me/);
    await expect(client.me()).rejects.not.toThrow(/private-token/);
  });
});
