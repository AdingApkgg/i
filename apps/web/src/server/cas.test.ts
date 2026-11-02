import { describe, expect, it } from "vitest";
import { casKey, extFor, storeCas } from "./cas";

const bytes = (s: string) => new TextEncoder().encode(s);

/** 内存版对象存储：记录写了几次 */
function fakeStore(initial: string[] = []) {
  const objects = new Map<string, Uint8Array>(initial.map((k) => [k, bytes("x")]));
  const puts: string[] = [];
  return {
    puts,
    objects,
    async head(key: string) {
      const found = objects.get(key);
      return found ? { size: found.byteLength } : null;
    },
    async put(key: string, body: Uint8Array) {
      puts.push(key);
      objects.set(key, body);
    },
  };
}

describe("casKey", () => {
  it("内容相同 key 相同，内容不同 key 不同", () => {
    expect(casKey(bytes("a"), "webp")).toBe(casKey(bytes("a"), "webp"));
    expect(casKey(bytes("a"), "webp")).not.toBe(casKey(bytes("b"), "webp"));
  });

  it("key 是 64 位小写十六进制加扩展名，不带路径分隔符", () => {
    const key = casKey(bytes("a"), "webp");
    expect(key).toMatch(/^[0-9a-f]{64}\.webp$/);
    expect(key).not.toContain("/");
  });
});

describe("extFor", () => {
  it("按 MIME 定扩展名，退回文件名后缀，再退回 bin", () => {
    expect(extFor("image/webp", "a.png")).toBe("webp");
    expect(extFor("", "a.PNG")).toBe("png");
    expect(extFor("", "无后缀")).toBe("bin");
    expect(extFor("application/octet-stream", "a.tar.gz")).toBe("gz");
  });
});

describe("storeCas", () => {
  it("新内容写入一次，返回可用的站内地址", async () => {
    const store = fakeStore();
    const res = await storeCas(store, bytes("a"), { type: "image/webp", name: "a.webp" });
    expect(store.puts).toEqual([res.key]);
    expect(res).toMatchObject({ deduped: false });
    expect(res.key).toMatch(/\.webp$/);
  });

  it("同内容第二次上传不重写，返回同一个 key", async () => {
    const store = fakeStore();
    const first = await storeCas(store, bytes("a"), { type: "image/webp", name: "a.webp" });
    const second = await storeCas(store, bytes("a"), { type: "image/webp", name: "a.webp" });
    expect(second.key).toBe(first.key);
    expect(second.deduped).toBe(true);
    expect(store.puts).toHaveLength(1);
  });
});
