import { describe, expect, it } from "vitest";
import { storedFileResponse } from "./stored-file-response";

describe("对象文件 HTTP 响应", () => {
  it("分段响应保持状态、范围、长度和流式正文", async () => {
    const response = storedFileResponse(
      new Response("234", {
        status: 206,
        headers: {
          "content-type": "video/mp4",
          "content-length": "3",
          "content-range": "bytes 2-4/6",
          "accept-ranges": "bytes",
        },
      }),
    );
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 2-4/6");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-length")).toBe("3");
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(await response.text()).toBe("234");
  });

  it("416 不变成服务器错误，也不长期缓存错误响应", () => {
    const response = storedFileResponse(
      new Response(null, { status: 416, headers: { "content-range": "bytes */6" } }),
    );
    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */6");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("不带 Range 的既有图片仍返回完整内容与长期缓存", async () => {
    const response = storedFileResponse(
      new Response("image", { headers: { "content-type": "image/png" } }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("immutable");
    expect(await response.text()).toBe("image");
  });
});
