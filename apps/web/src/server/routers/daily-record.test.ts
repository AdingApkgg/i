import { call } from "@orpc/server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, makeContext } from "../../../test/db";
import { dailyRecordRouter } from "./daily-record";

vi.mock("@i/db", async () => (await import("../../../test/mock-db")).dbModule());
vi.mock("@/lib/auth", () => ({ auth: {} }));
let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(() => t.close());
beforeEach(async () => {
  await t.reset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-16T04:00:00Z"));
});
afterEach(() => vi.useRealTimers());
const ctx = (role?: "user" | "admin") => ({ context: makeContext(t.db, { role }) });
describe("public daily counts", () => {
  it("is publicly readable, but visitors and ordinary users cannot write", async () => {
    expect((await call(dailyRecordRouter.year, { year: 2026 }, ctx())).days).toEqual([]);
    for (const role of [undefined, "user"] as const) {
      await expect(
        call(dailyRecordRouter.save, { date: "2026-10-16", count: 1 }, ctx(role)),
      ).rejects.toMatchObject({ code: role ? "FORBIDDEN" : "UNAUTHORIZED" });
      await expect(
        call(dailyRecordRouter.increment, { date: "2026-10-16" }, ctx(role)),
      ).rejects.toMatchObject({ code: role ? "FORBIDDEN" : "UNAUTHORIZED" });
    }
  });
  it("updates one row per day, publishes only date/count, and clears at zero", async () => {
    await call(dailyRecordRouter.save, { date: "2026-10-15", count: 2 }, ctx("admin"));
    await call(dailyRecordRouter.save, { date: "2026-10-15", count: 4 }, ctx("admin"));
    const result = await call(dailyRecordRouter.year, { year: 2026 }, ctx());
    expect(result).toMatchObject({ today: "2026-10-16", days: [{ date: "2026-10-15", count: 4 }] });
    expect(Object.keys(result.days[0]!).sort()).toEqual(["count", "date"]);
    await call(dailyRecordRouter.save, { date: "2026-10-15", count: 0 }, ctx("admin"));
    expect((await call(dailyRecordRouter.year, { year: 2026 }, ctx())).days).toEqual([]);
  });
  it("keeps simultaneous increments and filters the selected year", async () => {
    await call(dailyRecordRouter.save, { date: "2025-12-31", count: 2 }, ctx("admin"));
    await Promise.all(
      Array.from({ length: 5 }, () =>
        call(dailyRecordRouter.increment, { date: "2026-01-01" }, ctx("admin")),
      ),
    );
    expect((await call(dailyRecordRouter.year, { year: 2026 }, ctx())).days).toEqual([
      { date: "2026-01-01", count: 5 },
    ]);
    expect((await call(dailyRecordRouter.year, { year: 2025 }, ctx())).days).toEqual([
      { date: "2025-12-31", count: 2 },
    ]);
  });
  it("handles the count limit without losing the existing record", async () => {
    await call(dailyRecordRouter.save, { date: "2026-10-16", count: 1000 }, ctx("admin"));
    await expect(
      call(dailyRecordRouter.increment, { date: "2026-10-16" }, ctx("admin")),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect((await call(dailyRecordRouter.year, { year: 2026 }, ctx())).days).toEqual([
      { date: "2026-10-16", count: 1000 },
    ]);
  });

  it("rejects future/impossible days and noninteger or negative counts", async () => {
    for (const data of [
      { date: "2026-10-17", count: 1 },
      { date: "2026-02-31", count: 1 },
      { date: "2026-10-16", count: -1 },
      { date: "2026-10-16", count: 1.5 },
    ])
      await expect(call(dailyRecordRouter.save, data, ctx("admin"))).rejects.toMatchObject({
        code: "BAD_REQUEST",
      });
  });
});
