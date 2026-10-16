import { readFile } from "node:fs/promises";
import { expect, test } from "./fixtures";

test.describe("对象存储视频分段读取", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("真实 S3 与 HTTP 接口保留完整文件、指定范围、后缀范围及 416", async ({ request }) => {
    const bytes = await readFile(new URL("./media/sample.mp4", import.meta.url));
    const uploaded = await request.post("/api/gallery/upload", {
      multipart: { file: { name: "range-test.mp4", mimeType: "video/mp4", buffer: bytes } },
    });
    expect(uploaded.ok()).toBe(true);
    const { imageUrl } = await uploaded.json();
    expect(imageUrl).toMatch(/^\/api\/gallery\/files\/[^/]+\.mp4$/);
    try {
      const full = await request.get(imageUrl);
      expect(full.status()).toBe(200);
      expect(full.headers()["content-type"]).toContain("video/mp4");
      expect(await full.body()).toEqual(bytes);

      const part = await request.get(imageUrl, { headers: { Range: "bytes=2-7" } });
      expect(part.status()).toBe(206);
      expect(part.headers()["content-range"]).toBe(`bytes 2-7/${bytes.length}`);
      expect(part.headers()["content-length"]).toBe("6");
      expect(await part.body()).toEqual(bytes.subarray(2, 8));

      const suffix = await request.get(imageUrl, { headers: { Range: "bytes=-8" } });
      expect(suffix.status()).toBe(206);
      expect(await suffix.body()).toEqual(bytes.subarray(-8));

      const invalid = await request.get(imageUrl, {
        headers: { Range: `bytes=${bytes.length}-` },
      });
      expect(invalid.status()).toBe(416);
      expect(invalid.headers()["cache-control"]).toBe("private, no-store");
    } finally {
      const key = imageUrl.slice("/api/gallery/files/".length);
      const deleted = await request.delete(`/api/gallery/upload?key=${encodeURIComponent(key)}`);
      expect(deleted.ok()).toBe(true);
    }
  });
});
