import { data } from "react-router";
import { dailyDateSchema, dailyYearSchema, todayInShanghai } from "./daily-record";
import { serverApi } from "./orpc/api.server";
export async function loadDailyRecord(request: Request) {
  const url = new URL(request.url);
  const today = todayInShanghai();
  const result = dailyYearSchema.safeParse(
    Number(url.searchParams.get("year") ?? today.slice(0, 4)),
  );
  if (!result.success || result.data > Number(today.slice(0, 4)))
    throw data("年份无效", { status: 400 });
  const initial = await serverApi(request).dailyRecord.year({ year: result.data });
  const selected = url.searchParams.get("date");
  const initialDate =
    selected &&
    dailyDateSchema.safeParse(selected).success &&
    selected.startsWith(`${result.data}-`) &&
    selected <= today
      ? selected
      : undefined;
  return { initial, initialDate };
}
