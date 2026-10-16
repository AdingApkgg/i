import { Button, Card, CardBody, cn } from "@i/ui";
import { useState } from "react";
import { Link, useNavigate, useNavigation } from "react-router";
import { toast } from "sonner";
import { buildYearHeatmap, dailyDateSchema } from "@/lib/daily-record";
import { client } from "@/lib/orpc/client";
import { orpcErrText } from "@/lib/orpc/errors";
import type { RouterOutputs } from "@/server/router";

type YearData = RouterOutputs["dailyRecord"]["year"];
const colors = [
  "bg-[#ebedf0] dark:bg-[#161b22]",
  "bg-[#9be9a8] dark:bg-[#0e4429]",
  "bg-[#40c463] dark:bg-[#006d32]",
  "bg-[#30a14e] dark:bg-[#26a641]",
  "bg-[#216e39] dark:bg-[#39d353]",
];
const input =
  "rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";
export function DailyJournal({
  initial,
  initialDate,
  editable = false,
}: {
  initial: YearData;
  initialDate?: string;
  editable?: boolean;
}) {
  const { year, today } = initial;
  const [selected, setSelected] = useState(
    initialDate ?? (today.startsWith(`${year}-`) ? today : `${year}-12-31`),
  );
  const [days, setDays] = useState(initial.days);
  const calendar = buildYearHeatmap(year, days, today);
  const selectedCount = days.find((d) => d.date === selected)?.count ?? 0;
  const navigate = useNavigate();
  const navigation = useNavigation();
  const [busy, setBusy] = useState(false);
  const unavailable = busy || navigation.state !== "idle" || Number(selected.slice(0, 4)) !== year;
  function selectDate(date: string) {
    setSelected(date);
    if (
      dailyDateSchema.safeParse(date).success &&
      date <= today &&
      Number(date.slice(0, 4)) !== year
    ) {
      navigate(`?year=${date.slice(0, 4)}&date=${date}`);
    }
  }
  async function save(count?: number) {
    if (unavailable || !dailyDateSchema.safeParse(selected).success || selected > today) return;
    setBusy(true);
    try {
      const result =
        count == null
          ? await client.dailyRecord.increment({ date: selected })
          : await client.dailyRecord.save({ date: selected, count });
      setDays((previous) => [
        ...previous.filter((day) => day.date !== result.date),
        ...(result.count > 0 ? [result] : []),
      ]);
      toast.success(count === 0 ? "已清除当天记录" : "已保存次数");
    } catch (e) {
      toast.error(orpcErrText(e, "保存失败"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {year > 1970 ? (
            <Link
              to={`?year=${year - 1}`}
              aria-label="上一年"
              className="rounded-md border border-border px-3 py-1.5 text-sm"
            >
              ←
            </Link>
          ) : (
            <button
              type="button"
              aria-label="上一年"
              disabled
              className="rounded-md border border-border px-3 py-1.5 text-sm opacity-40"
            >
              ←
            </button>
          )}
          <h2 className="whitespace-nowrap text-lg font-semibold">{year} 年</h2>
          {year < Number(today.slice(0, 4)) && (
            <Link
              to={`?year=${year + 1}`}
              aria-label="下一年"
              className="rounded-md border border-border px-3 py-1.5 text-sm"
            >
              →
            </Link>
          )}
        </div>
        {!today.startsWith(`${year}-`) && (
          <Link to={`?year=${today.slice(0, 4)}`} className="text-sm text-primary hover:underline">
            回到今年
          </Link>
        )}
      </div>
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 100px), 1fr))" }}
      >
        {[
          ["全年合计", `${calendar.total} 次`],
          ["记录天数", `${calendar.activeDays} 天`],
          ["单日最多", `${calendar.maxCount} 次`],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardBody className="p-3 sm:p-4">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="mt-1 text-lg font-semibold sm:text-2xl">{value}</div>
            </CardBody>
          </Card>
        ))}
      </div>
      <Card>
        <CardBody className="min-w-0 space-y-4 p-3 sm:p-5">
          <section
            aria-label="年度日历热力图"
            className="max-w-full overflow-x-auto pb-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="w-max pb-1">
              <div
                className="mb-2 ml-8 grid gap-[3px] text-[10px] text-muted-foreground"
                style={{ gridTemplateColumns: `repeat(${calendar.weeks.length}, 13px)` }}
              >
                {calendar.months.map((month) => (
                  <span
                    key={month.label}
                    style={{ gridColumn: `${month.column} / span 3`, gridRow: 1 }}
                  >
                    {month.label}
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="grid w-6 grid-rows-7 gap-[3px] text-[10px] leading-[13px] text-muted-foreground">
                  <span />
                  <span>一</span>
                  <span />
                  <span>三</span>
                  <span />
                  <span>五</span>
                  <span />
                </div>
                <div
                  className="grid grid-flow-col grid-rows-7 gap-[3px]"
                  style={{ gridAutoColumns: "13px" }}
                >
                  {calendar.weeks
                    .flat()
                    .map((day) =>
                      !day.inYear || day.future ? (
                        <span
                          key={day.date}
                          aria-hidden="true"
                          className={cn("size-[13px] rounded-[3px]", day.inYear && "bg-muted/30")}
                        />
                      ) : (
                        <button
                          type="button"
                          key={day.date}
                          title={`${day.date}：${day.count} 次`}
                          aria-label={`${day.date}：${day.count} 次`}
                          aria-pressed={selected === day.date}
                          disabled={busy || navigation.state !== "idle"}
                          onClick={() => setSelected(day.date)}
                          className={cn(
                            "size-[13px] rounded-[3px] outline-none focus-visible:ring-2 focus-visible:ring-primary",
                            colors[Math.min(4, day.count)],
                            selected === day.date &&
                              "ring-2 ring-primary ring-offset-1 ring-offset-background",
                          )}
                        />
                      ),
                    )}
                </div>
              </div>
            </div>
          </section>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{selected ? `${selected}：${selectedCount} 次` : "选择一天查看次数"}</span>
            <div className="flex items-center gap-1.5">
              <span className="sr-only">颜色说明：0、1、2、3、4 次及以上</span>少
              {colors.map((color, n) => (
                <span
                  key={color}
                  title={n === 4 ? "4 次及以上" : `${n} 次`}
                  className={cn("size-[13px] rounded-[3px]", color)}
                />
              ))}
              多
            </div>
          </div>
          {calendar.activeDays === 0 && (
            <p className="text-sm text-muted-foreground">这一年还没有记录。</p>
          )}
        </CardBody>
      </Card>
      {editable && (
        <Card>
          <CardBody className="space-y-4">
            <h2 className="font-semibold">记录当天次数</h2>
            <p className="text-sm text-muted-foreground">
              日期按北京时间。保存会更新当天总次数，填 0 可清除记录。
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-0 max-w-full space-y-1 text-sm">
                <span className="block">日期</span>
                <input
                  type="date"
                  min="1970-01-01"
                  max={today}
                  value={selected}
                  disabled={busy || navigation.state !== "idle"}
                  onChange={(e) => selectDate(e.target.value)}
                  className={`${input} min-w-0 max-w-full`}
                />
              </label>
              <CountEditor
                key={`${selected}:${selectedCount}`}
                saved={selectedCount}
                disabled={
                  unavailable || !dailyDateSchema.safeParse(selected).success || selected > today
                }
                onSave={(count) => void save(count)}
                onIncrement={() => void save()}
              />
            </div>
            <Link
              to={`/masturbation?year=${year}`}
              className="inline-block text-sm text-primary hover:underline"
            >
              查看公开页面 ↗
            </Link>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
function CountEditor({
  saved,
  disabled,
  onSave,
  onIncrement,
}: {
  saved: number;
  disabled: boolean;
  onSave: (n: number) => void;
  onIncrement: () => void;
}) {
  const [count, setCount] = useState(String(saved));
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(Number(count));
      }}
    >
      <label className="space-y-1 text-sm">
        <span className="block">次数</span>
        <input
          className={`${input} w-24`}
          type="number"
          min={0}
          max={1000}
          step={1}
          required
          value={count}
          disabled={disabled}
          onChange={(e) => setCount(e.target.value)}
        />
      </label>
      <Button type="submit" disabled={disabled}>
        保存次数
      </Button>
      <Button type="button" variant="ghost" disabled={disabled} onClick={onIncrement}>
        当天 +1
      </Button>
      {saved > 0 && (
        <Button type="button" variant="ghost" disabled={disabled} onClick={() => onSave(0)}>
          清除当天
        </Button>
      )}
    </form>
  );
}
