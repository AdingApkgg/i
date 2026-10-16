import { DailyJournal } from "@/components/daily-record/journal";
import { PageTitle } from "@/components/public/site-header";
import { loadDailyRecord } from "@/lib/daily-record-loader.server";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/masturbation";
export const headers = () => ({ "Cache-Control": "no-store", "CDN-Cache-Control": "no-store" });
export function loader({ request }: Route.LoaderArgs) {
  return loadDailyRecord(request);
}
export const meta: Route.MetaFunction = (args) =>
  seo(args, { title: "自慰记录", path: "/masturbation" });
export default function MasturbationPage({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <PageTitle title="自慰记录" subtitle="每日次数 · 年度日历" />
      <DailyJournal
        key={`${loaderData.initial.year}:${loaderData.initialDate ?? ""}`}
        {...loaderData}
      />
    </>
  );
}
