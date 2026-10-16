import { aiTranslation, vn } from "@i/db/schema";
import { call } from "@orpc/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, makeContext } from "../../../test/db";
import { translationRouter } from "./translation";

vi.mock("@i/db", async () => (await import("../../../test/mock-db")).dbModule());
vi.mock("@/lib/auth", () => ({ auth: {} }));
let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(() => t.close());
beforeEach(async () => {
  await t.reset();
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-at-least-thirty-two-characters");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const ctx = (role?: "user" | "admin") => ({ context: makeContext(t.db, { role }) });
const config = {
  baseUrl: "https://ai.example/v1",
  model: "test-model",
  enabled: true,
  apiKey: "test-private-key",
};
describe("translation admin API", () => {
  it("denies visitors and users before any provider request", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    for (const role of [undefined, "user"] as const) {
      await expect(call(translationRouter.settings, undefined, ctx(role))).rejects.toMatchObject({
        code: role ? "FORBIDDEN" : "UNAUTHORIZED",
      });
      await expect(
        call(translationRouter.preview, { text: "hello" }, ctx(role)),
      ).rejects.toMatchObject({ code: role ? "FORBIDDEN" : "UNAUTHORIZED" });
      await expect(call(translationRouter.saveSettings, config, ctx(role))).rejects.toMatchObject({
        code: role ? "FORBIDDEN" : "UNAUTHORIZED",
      });
    }
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("keeps encrypted keys private; blank retains, clear removes, host change needs a new key", async () => {
    expect(await call(translationRouter.settings, undefined, ctx("admin"))).toMatchObject({
      enabled: false,
      hasKey: false,
    });
    const result = await call(translationRouter.saveSettings, config, ctx("admin"));
    expect(result).toEqual({
      baseUrl: config.baseUrl,
      model: config.model,
      enabled: true,
      hasKey: true,
    });
    expect(JSON.stringify(await t.db.select().from(aiTranslation))).not.toContain(config.apiKey);
    await call(
      translationRouter.saveSettings,
      { ...config, model: "new-model", apiKey: "" },
      ctx("admin"),
    );
    await expect(
      call(
        translationRouter.saveSettings,
        { ...config, baseUrl: "https://other.example/v1", apiKey: "" },
        ctx("admin"),
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await call(
      translationRouter.saveSettings,
      { ...config, enabled: false, apiKey: "", clearKey: true },
      ctx("admin"),
    );
    expect(await call(translationRouter.settings, undefined, ctx("admin"))).toMatchObject({
      hasKey: false,
    });
  });
  it("preview requires configuration and never writes translated content", async () => {
    await expect(
      call(translationRouter.preview, { text: "hello" }, ctx("admin")),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await t.db.insert(vn).values({ title: "Novel", descriptionOriginal: "hello" });
    await call(translationRouter.saveSettings, config, ctx("admin"));
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response(JSON.stringify({ choices: [{ message: { content: "你好" } }] })),
      ),
    );
    expect(await call(translationRouter.preview, { text: "hello" }, ctx("admin"))).toEqual({
      text: "你好",
      model: "test-model",
    });
    expect((await t.db.select().from(vn))[0]!.descriptionZh).toBeNull();
  });
});
