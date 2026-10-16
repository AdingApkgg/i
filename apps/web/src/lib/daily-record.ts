import { z } from "zod";
import { SITE_TIME_ZONE } from "./format";

export const dailyYearSchema = z.number().int().min(1970).max(2100);
export const dailyDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "请选择有效日期")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      Number.isFinite(date.getTime()) &&
      date.toISOString().slice(0, 10) === value &&
      Number(value.slice(0, 4)) >= 1970 &&
      Number(value.slice(0, 4)) <= 2100
    );
  }, "请选择有效日期");
export interface DailyCount {
  date: string;
  count: number;
}
export function todayInShanghai(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: SITE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (name: string) => parts.find((p) => p.type === name)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function buildYearHeatmap(year: number, rows: DailyCount[], today: string) {
  const start = Date.UTC(year, 0, 1),
    end = Date.UTC(year + 1, 0, 1),
    dayMs = 86400000;
  const offset = new Date(start).getUTCDay();
  const counts = new Map(
    rows
      .filter((r) => r.date.startsWith(`${year}-`) && r.date <= today)
      .map((r) => [r.date, r.count]),
  );
  const weeks: { date: string; count: number; inYear: boolean; future: boolean }[][] = [];
  for (let time = start - offset * dayMs; time < end || weeks.at(-1)?.length !== 7; time += dayMs) {
    if (!weeks.length || weeks.at(-1)!.length === 7) weeks.push([]);
    const date = new Date(time).toISOString().slice(0, 10);
    const week = weeks.at(-1)!;
    week.push({
      date,
      count: counts.get(date) ?? 0,
      inYear: time >= start && time < end,
      future: date > today,
    });
  }
  const months = Array.from({ length: 12 }, (_, month) => ({
    label: `${month + 1}月`,
    column: Math.floor((Math.round((Date.UTC(year, month, 1) - start) / dayMs) + offset) / 7) + 1,
  }));
  const values = [...counts.values()];
  return {
    weeks,
    months,
    total: values.reduce((a, b) => a + b, 0),
    activeDays: values.filter((n) => n > 0).length,
    maxCount: Math.max(0, ...values),
  };
}
