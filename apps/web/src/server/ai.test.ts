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

  it("uses Riva's English-to-Simplified-Chinese prompt and supported generation parameters", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({
        choices: [{ message: { content: "一个关于友谊的故事。" }, finish_reason: "stop" }],
      }),
    );
    const text = "A story about friendship.";
    await translateText(
      {
        baseUrl: "https://integrate.api.nvidia.com/v1",
        model: "nvidia/riva-translate-4b-instruct-v2",
        apiKey: "test-key",
      },
      text,
      fetcher,
    );
    expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toEqual({
      model: "nvidia/riva-translate-4b-instruct-v2",
      stream: false,
      temperature: 0,
      max_tokens: 4096,
      messages: [
        { role: "system", content: "en-zh-cn" },
        { role: "user", content: text },
      ],
    });
  });

  it("splits long Riva input without losing source text or paragraph boundaries", async () => {
    const paragraphs = ["A summer story. ".repeat(240).trim(), "夜空🌟".repeat(800), "The end."];
    const source = paragraphs.join("\n\n");
    const inputs: string[] = [];
    const fetcher: typeof fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body));
      const input = body.messages[1].content;
      inputs.push(input);
      expect(Buffer.byteLength(input, "utf8")).toBeLessThanOrEqual(2000);
      expect(input).not.toMatch(/[\uD800-\uDBFF]$|^[\uDC00-\uDFFF]/u);
      return Response.json({ choices: [{ message: { content: input }, finish_reason: "stop" }] });
    };
    const result = await translateText(
      {
        baseUrl: "https://integrate.api.nvidia.com/v1",
        model: "nvidia/riva-translate-4b-instruct-v2",
        apiKey: "test-key",
      },
      source,
      fetcher,
    );
    expect(inputs.length).toBeGreaterThan(3);
    expect(result.replace(/\s/g, "")).toBe(source.replace(/\s/g, ""));
    expect(result.split("\n\n")).toHaveLength(3);
  });

  it("never returns a partial translation if a later Riva chunk is truncated", async () => {
    let requests = 0;
    const fetcher: typeof fetch = async () =>
      Response.json({
        choices: [
          { message: { content: "译文" }, finish_reason: ++requests === 1 ? "stop" : "length" },
        ],
      });
    await expect(
      translateText(
        {
          baseUrl: "https://integrate.api.nvidia.com/v1",
          model: "nvidia/riva-translate-4b-instruct-v2",
          apiKey: "test-key",
        },
        "An unusually long story. ".repeat(120),
        fetcher,
      ),
    ).rejects.toMatchObject({ message: "译文被模型截断，请调整模型后重试" });
    expect(requests).toBe(2);
  });

  it("translates two Riva paragraphs concurrently and restores their source order", async () => {
    let activeRequests = 0;
    let peakRequests = 0;
    let requestIndex = 0;
    const fetcher: typeof fetch = async () => {
      const index = requestIndex++;
      activeRequests++;
      peakRequests = Math.max(peakRequests, activeRequests);
      await new Promise((resolve) => setTimeout(resolve, index === 0 ? 20 : 1));
      activeRequests--;
      return Response.json({
        choices: [{ message: { content: `段落${index + 1}` }, finish_reason: "stop" }],
      });
    };
    const result = await translateText(
      {
        baseUrl: "https://integrate.api.nvidia.com/v1",
        model: "nvidia/riva-translate-4b-instruct-v2",
        apiKey: "test-key",
      },
      "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.",
      fetcher,
    );
    expect(peakRequests).toBe(2);
    expect(result).toBe("段落1\n\n段落2\n\n段落3");
  });

  it("reserves the process-wide request limit and releases it after Riva completes", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const response = () =>
      Response.json({ choices: [{ message: { content: "译文" }, finish_reason: "stop" }] });
    const pending = translateText(
      {
        baseUrl: "https://integrate.api.nvidia.com/v1",
        model: "nvidia/riva-translate-4b-instruct-v2",
        apiKey: "test-key",
      },
      "First paragraph.\n\nSecond paragraph.",
      async () => {
        await gate;
        return response();
      },
    );
    const generic = { baseUrl: "https://ai.example/v1", model: "generic", apiKey: "test-key" };
    const fetcher = vi.fn<typeof fetch>(async () => response());
    try {
      await expect(translateText(generic, "text", fetcher)).rejects.toMatchObject({
        code: "TOO_MANY_REQUESTS",
      });
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      release();
      await pending;
    }
    expect(await translateText(generic, "text", fetcher)).toBe("译文");
  });
});
