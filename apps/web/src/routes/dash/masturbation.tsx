import { DailyJournal } from "@/components/daily-record/journal";
import { loadDailyRecord } from "@/lib/daily-record-loader.server";
import type { Route } from "./+types/masturbation";
export function loader({ request }: Route.LoaderArgs) {
  return loadDailyRecord(request);
}
export default function DailyRecordAdmin({ loaderData }: Route.ComponentProps) {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">自慰记录</h1>
      <DailyJournal
        key={`${loaderData.initial.year}:${loaderData.initialDate ?? ""}`}
        {...loaderData}
        editable
      />
    </div>
  );
}
