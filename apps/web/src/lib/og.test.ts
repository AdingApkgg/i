import { afterEach, describe, expect, it, vi } from "vitest";
import { OG_SIZE, renderOgImage } from "./og";

afterEach(() => vi.unstubAllGlobals());

/** PNG 头里的宽高（IHDR） */
function pngSize(buf: ArrayBuffer) {
  const v = new DataView(buf);
  const sig = [...new Uint8Array(buf.slice(0, 8))];
  expect(sig).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return { width: v.getUint32(16), height: v.getUint32(20) };
}

describe("renderOgImage", () => {
  // 首次加载 satori / resvg 的 WASM 较慢
  it("拉不到中文字体时降级为拉丁文卡片，仍输出 1200×630 PNG", { timeout: 30_000 }, async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    const res = await renderOgImage({ eyebrow: "博客", title: "你好，世界", meta: "2024年1月1日" });
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(res.headers.get("cdn-cache-control")).toContain("stale-while-revalidate");
    expect(pngSize(await res.arrayBuffer())).toEqual(OG_SIZE);
  });
});
