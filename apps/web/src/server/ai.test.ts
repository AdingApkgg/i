import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptKey, encryptKey, normalizeBaseUrl, translateText } from "./ai";

afterEach(() => vi.unstubAllEnvs());
describe("AI private configuration", () => {
  it("encrypts with random authenticated ciphertext and refuses another secret", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-at-least-thirty-two-characters");
    const encrypted = encryptKey("test-provider-key");
    expect(encrypted).not.toContain("test-provider-key");
    expect(encryptKey("test-provider-key")).not.toBe(encrypted);
    expect(decryptKey(encrypted)).toBe("test-provider-key");
    vi.stubEnv("BETTER_AUTH_SECRET", "a-different-secret-at-least-thirty-two-characters");
    expect(() => decryptKey(encrypted)).toThrow();
  });
  it("requires a clean HTTPS base and appends chat/completions once", async () => {
    expect(normalizeBaseUrl("https://ai.example/v1/")).toBe("https://ai.example/v1");
    for (const url of [
      "http://ai.example/v1",
      "https://u:p@ai.example",
      "https://ai.example?token=x",
      "https://ai.example/#x",
    ])
      expect(() => normalizeBaseUrl(url)).toThrow();
    const fetcher = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ choices: [{ message: { content: "中文简介" } }] })),
    );
    expect(
      await translateText(
        { baseUrl: "https://ai.example/v1", model: "test-model", apiKey: "test-key" },
        "Original",
        fetcher,
      ),
    ).toBe("中文简介");
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://ai.example/v1/chat/completions");
    expect(init?.redirect).toBe("error");
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: "test-model", stream: false });
  });
  it("sanitizes upstream errors and rejects empty or oversized output", async () => {
    const config = { baseUrl: "https://ai.example/v1", model: "test-model", apiKey: "secret" };
    await expect(
      translateText(
        config,
        "text",
        async () => new Response("secret provider debug", { status: 401 }),
      ),
    ).rejects.toMatchObject({ message: "AI 服务认证失败，请检查密钥" });
    await expect(
      translateText(
        config,
        "text",
        async () => new Response(JSON.stringify({ choices: [{ message: { content: "" } }] })),
      ),
    ).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    await expect(
      translateText(config, "text", async () => new Response("x".repeat(1_100_000))),
    ).rejects.toMatchObject({ code: "BAD_GATEWAY" });
  });
});
