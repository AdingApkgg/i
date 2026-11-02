import { describe, expect, it, vi } from "vitest";
import { shouldSync } from "./scheduler";

vi.mock("@i/db", async () => (await import("../../../test/mock-db")).dbModule());
describe("Bangumi 同步退避", () => {
  const now = 20 * 60000;
  it("冲突或网络失败后不到10分钟不重复全量扫描，新的明确编辑可唤醒", () => {
    const account = { autoSync: true, lastAttemptAt: new Date(now - 60000), lastError: "存在冲突" };
    expect(shouldSync(account, false, false, now)).toBe(false);
    expect(shouldSync(account, true, false, now)).toBe(false);
    expect(shouldSync(account, true, true, now)).toBe(true);
    expect(
      shouldSync({ ...account, lastAttemptAt: new Date(now - 10 * 60000) }, false, false, now),
    ).toBe(true);
  });
  it("关自动检查仍可处理排队编辑，成功后的无待办不反复运行", () => {
    const account = { autoSync: false, lastAttemptAt: new Date(now - 60000), lastError: null };
    expect(shouldSync(account, true, false, now)).toBe(true);
    expect(shouldSync(account, false, false, now)).toBe(false);
  });
});
