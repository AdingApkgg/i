import { describe, expect, it } from "vitest";
import { buildYearHeatmap, dailyDateSchema, todayInShanghai } from "./daily-record";

describe("daily record calendar", () => {
  it("uses Shanghai date across UTC midnight", () => {
    expect(todayInShanghai(new Date("2026-10-15T17:00:00Z"))).toBe("2026-10-16");
  });
  it("accepts real leap dates, rejects impossible or malformed dates", () => {
    expect(dailyDateSchema.safeParse("2024-02-29").success).toBe(true);
    for (const day of [
      "2025-02-29",
      "2026-02-31",
      "2026-13-01",
      "2026-1-01",
      "2026-10-16T00:00:00Z",
    ])
      expect(dailyDateSchema.safeParse(day).success).toBe(false);
  });
  it("includes exactly every day in a leap year and preserves calendar columns", () => {
    const calendar = buildYearHeatmap(
      2024,
      [
        { date: "2024-02-29", count: 3 },
        { date: "2024-12-31", count: 2 },
      ],
      "2026-10-16",
    );
    const days = calendar.weeks.flat().filter((d) => d.inYear);
    expect(days).toHaveLength(366);
    expect(new Set(days.map((d) => d.date)).size).toBe(366);
    expect(days[0]!.date).toBe("2024-01-01");
    expect(days.at(-1)!.date).toBe("2024-12-31");
    expect(calendar.weeks[0]![0]!.inYear).toBe(false);
    expect(calendar.weeks[0]![1]!.date).toBe("2024-01-01");
    expect(calendar).toMatchObject({ total: 5, activeDays: 2, maxCount: 3 });
    expect(calendar.months).toHaveLength(12);
  });
  it("handles Sunday starts and ignores entries outside the year or after today", () => {
    const calendar = buildYearHeatmap(
      2023,
      [
        { date: "2022-12-31", count: 9 },
        { date: "2023-01-01", count: 2 },
        { date: "2023-12-31", count: 8 },
      ],
      "2023-06-01",
    );
    expect(calendar.weeks[0]![0]!.date).toBe("2023-01-01");
    expect(calendar.weeks.flat().filter((d) => d.inYear)).toHaveLength(365);
    expect(calendar.total).toBe(2);
    expect(calendar.weeks.flat().find((d) => d.date === "2023-12-31")!.future).toBe(true);
  });
});
