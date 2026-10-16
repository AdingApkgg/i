import { createStorage, StorageError } from "@i/db/storage";
import { afterEach, describe, expect, it, vi } from "vitest";

// 不连真实 S3：拦截全局 fetch，记录 aws4fetch 发出的请求
function stubFetch(handler: (req: Request) => Response) {
  const seen: Request[] = [];
  vi.stubGlobal("fetch", async (req: Request) => {
    seen.push(req);
    return handler(req);
  });
  return seen;
}

const cfg = { endpoint: "http://s3.test/", accessKey: "ak", secretKey: "sk", bucket: "gallery" };

afterEach(() => vi.unstubAllGlobals());

describe("storage", () => {
  it("path-style 寻址、逐段编码 key，并带 SigV4 签名", async () => {
    const seen = stubFetch(() => new Response(null, { status: 200 }));
    await createStorage(cfg).put("相册/a b.png", new Uint8Array([1, 2, 3]), "image/png");

    const [head, put] = seen;
    expect(head!.method).toBe("HEAD");
    expect(head!.url).toBe("http://s3.test/gallery");
    expect(put!.method).toBe("PUT");
    expect(put!.url).toBe("http://s3.test/gallery/%E7%9B%B8%E5%86%8C/a%20b.png");
    expect(put!.headers.get("content-type")).toBe("image/png");
    expect(put!.headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256 Credential=ak\//);
  });

  it("桶不存在时先建桶，且每个实例只确认一次", async () => {
    const seen = stubFetch((req) =>
      req.method === "HEAD" ? new Response(null, { status: 404 }) : new Response(null),
    );
    const s = createStorage(cfg);
    await s.put("a.png", new Uint8Array(), "image/png");
    await s.put("b.png", new Uint8Array(), "image/png");
    expect(seen.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual([
      "HEAD /gallery",
      "PUT /gallery",
      "PUT /gallery/a.png",
      "PUT /gallery/b.png",
    ]);
  });

  it("get / head 遇到 404 返回 null，其他错误抛 StorageError", async () => {
    stubFetch((req) =>
      new URL(req.url).pathname.endsWith("missing.png")
        ? new Response(null, { status: 404 })
        : new Response("<Error>AccessDenied</Error>", { status: 403 }),
    );
    const s = createStorage(cfg);
    expect(await s.get("missing.png")).toBeNull();
    expect(await s.head("missing.png")).toBeNull();
    await expect(s.get("x.png")).rejects.toMatchObject({ status: 403 });
  });

  it("视频 Range 请求传给对象存储，并保留 206 分段响应", async () => {
    stubFetch((req) =>
      req.headers.get("range") === "bytes=2-4"
        ? new Response("234", { status: 206, headers: { "content-range": "bytes 2-4/6" } })
        : new Response("012345"),
    );
    const response = await createStorage(cfg).get("video.mp4", "bytes=2-4");
    expect(response?.status).toBe(206);
    expect(response?.headers.get("content-range")).toBe("bytes 2-4/6");
    expect(await response?.text()).toBe("234");
  });

  it("不可满足的 Range 保留 416，交给 HTTP 层返回客户端", async () => {
    stubFetch((req) =>
      req.headers.has("range")
        ? new Response(null, { status: 416, headers: { "content-range": "bytes */6" } })
        : new Response("012345"),
    );
    const response = await createStorage(cfg).get("video.mp4", "bytes=6-");
    expect(response?.status).toBe(416);
    expect(response?.headers.get("content-range")).toBe("bytes */6");
  });

  it("拒绝空段和 . / .. 段，不发请求（否则会被规范化成对桶或根的操作）", async () => {
    const seen = stubFetch(() => new Response(null));
    const s = createStorage(cfg);
    for (const key of ["", ".", "..", "a/../b", "a//b"]) {
      await expect(s.get(key)).rejects.toBeInstanceOf(StorageError);
      await expect(s.delete(key)).rejects.toMatchObject({ status: 400 });
    }
    expect(seen).toHaveLength(0);
  });

  it("list 按 continuation-token 翻页并解码 XML 实体", async () => {
    const page = (keys: string[], next?: string) =>
      new Response(
        `<ListBucketResult>${keys
          .map((k) => `<Contents><Key>${k}</Key><Size>${k.length}</Size></Contents>`)
          .join("")}<IsTruncated>${!!next}</IsTruncated>${
          next ? `<NextContinuationToken>${next}</NextContinuationToken>` : ""
        }</ListBucketResult>`,
      );
    const seen = stubFetch((req) =>
      new URL(req.url).searchParams.get("continuation-token") === "t&2"
        ? page(["c.png"])
        : page(["a.png", "b&amp;c.png"], "t&amp;2"),
    );
    const out = [];
    for await (const o of createStorage(cfg).list()) out.push(o);
    expect(out).toEqual([
      { key: "a.png", size: 5 },
      { key: "b&c.png", size: 11 },
      { key: "c.png", size: 5 },
    ]);
    expect(seen).toHaveLength(2);
  });
});
