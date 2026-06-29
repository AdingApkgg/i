"use client";

import { Button } from "@i/ui";
import {
  getCount,
  getHealth,
  type CountResp,
  type Health,
} from "@i/api-client";
import { useEffect, useState } from "react";
import { t } from "../lib/i18n";

export default function Home() {
  const [count, setCount] = useState<CountResp | null>(null);
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    getCount("/").then(setCount).catch(() => undefined);
    getHealth().then(setHealth).catch(() => undefined);
  }, []);

  return (
    <main className="mx-auto max-w-2xl p-10 font-sans">
      <h1 className="text-3xl font-bold">{t("home.title")}</h1>
      <p className="mt-2 text-sm opacity-60">{t("home.subtitle")}</p>

      <div className="mt-6 space-y-1 text-sm">
        <p>
          {t("home.health")}:{" "}
          {health ? `db=${health.db} · redis=${health.redis}` : "…"}
        </p>
        <p>
          {t("home.pageViews")}:{" "}
          {count ? `${count.page_pv}（站点 ${count.site_pv}）` : "…"}
        </p>
      </div>

      <Button className="mt-6" onClick={() => getCount("/").then(setCount)}>
        {t("home.recount")}
      </Button>
    </main>
  );
}
