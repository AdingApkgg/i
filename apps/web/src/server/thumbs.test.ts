import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THUMB_WIDTHS, thumb, thumbProps } from "@/lib/thumb";

// 内存版对象存储：只实现缩略图用到的 get / put / delete
const store = vi.hoisted(() => new Map<string, { bytes: Uint8Array; type: string }>());
const puts = vi.hoisted(() => ({ n: 0 }));
vi.mock("@/lib/s3", () => ({
  storage: {
    async get(key: string) {
      const o = store.get(key);
      return o ? new Response(o.bytes as BodyInit, { headers: { "content-type": o.type } }) : null;
    },
    async put(key: string, bytes: Uint8Array, type: string) {
      puts.n++;
      store.set(key, { bytes, type });
    },
    async delete(key: string) {
      store.delete(key);
    },
  },
}));

const { deleteThumbs, getThumb, thumbKey } = await import("./thumbs");

async function png(width: number, height: number) {
  const buf = await sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 182, b: 193 } },
  })
    .png()
    .toBuffer();
  return new Uint8Array(buf);
}

async function sizeOf(res: Response) {
  const m = await sharp(new Uint8Array(await res.arrayBuffer())).metadata();
  return { format: m.format, width: m.width, height: m.height };
}

beforeEach(() => {
  store.clear();
  puts.n = 0;
});

describe("缩略图生成", () => {
  it("等比缩到目标宽度、输出 WebP，并存回存储供下次直接读", async () => {
    store.set("a.png", { bytes: await png(1600, 1200), type: "image/png" });

    const res = await getThumb("a.png", 640);
    expect(res?.headers.get("content-type")).toBe("image/webp");
    expect(res?.headers.get("cache-control")).toContain("immutable");
    expect(await sizeOf(res!)).toEqual({ format: "webp", width: 640, height: 480 });
    expect(store.has(thumbKey("a.png", 640))).toBe(true);

    // 第二次命中缓存：不再生成 / 写入
    const again = await getThumb("a.png", 640);
    expect((await sizeOf(again!)).width).toBe(640);
    expect(puts.n).toBe(1);
  });

  it("不放大：原图比目标宽度小时保持原尺寸", async () => {
    store.set("small.png", { bytes: await png(500, 300), type: "image/png" });
    expect(await sizeOf((await getThumb("small.png", 1920))!)).toMatchObject({ width: 500 });
  });

  it("同一张缩略图的并发请求只生成一次", async () => {
    store.set("b.png", { bytes: await png(1200, 800), type: "image/png" });
    const all = await Promise.all(Array.from({ length: 5 }, () => getThumb("b.png", 320)));
    expect(all.every((r) => r?.headers.get("content-type") === "image/webp")).toBe(true);
    expect(puts.n).toBe(1);
  });

  it("矢量图、原图不存在、解码失败时返回 null（由路由回退原图）", async () => {
    store.set("c.svg", { bytes: new TextEncoder().encode("<svg/>"), type: "image/svg+xml" });
    store.set("broken.jpg", { bytes: new Uint8Array([1, 2, 3]), type: "image/jpeg" });
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(await getThumb("c.svg", 640)).toBeNull();
    expect(await getThumb("missing.png", 640)).toBeNull();
    expect(await getThumb("broken.jpg", 640)).toBeNull();
    expect(puts.n).toBe(0);
  });

  it("删除原图时清掉各档缩略图", async () => {
    store.set("d.png", { bytes: await png(800, 600), type: "image/png" });
    await getThumb("d.png", 320);
    await getThumb("d.png", 640);
    await deleteThumbs("d.png");
    expect([...store.keys()]).toEqual(["d.png"]);
  });
});

describe("缩略图地址", () => {
  const url = "/api/gallery/files/x.jpg";

  it("站内存储的位图加 ?w=，外链 / svg / 已带参数的原样返回", () => {
    expect(thumb(url, 640)).toBe(`${url}?w=640`);
    expect(thumb("https://example.com/a.jpg", 640)).toBe("https://example.com/a.jpg");
    expect(thumb("/api/gallery/files/x.svg", 640)).toBe("/api/gallery/files/x.svg");
    expect(thumb(`${url}?w=320`, 640)).toBe(`${url}?w=320`);
  });

  it("srcset 列出各档宽度，src 取最大一档", () => {
    expect(thumbProps(url, [320, 640], "50vw")).toEqual({
      src: `${url}?w=640`,
      srcSet: `${url}?w=320 320w, ${url}?w=640 640w`,
      sizes: "50vw",
    });
    expect(thumbProps("https://example.com/a.jpg", [320], "50vw")).toEqual({
      src: "https://example.com/a.jpg",
    });
  });

  it("宽度档位升序且不重复（srcset 约定）", () => {
    expect([...THUMB_WIDTHS].sort((a, b) => a - b)).toEqual([...new Set(THUMB_WIDTHS)]);
  });
});
