"use client";

import { Button, Card, CardBody } from "@i/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";

const input =
  "w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

export default function MaimaiAdmin() {
  const trpc = useTRPC();
  const { data: cfg } = useQuery(trpc.maimai.config.queryOptions());
  const [source, setSource] = useState<"diving-fish" | "lxns">("diving-fish");
  const [df, setDf] = useState("");
  const [dfToken, setDfToken] = useState("");
  const [lx, setLx] = useState("");

  useEffect(() => {
    if (!cfg) return;
    setSource((cfg.source as "diving-fish" | "lxns") ?? "diving-fish");
    setDf(cfg.divingFishUsername ?? "");
    setDfToken(cfg.divingFishImportToken ?? "");
    setLx(cfg.lxnsPersonalToken ?? "");
  }, [cfg]);

  const save = useMutation({
    ...trpc.maimai.saveConfig.mutationOptions(),
    onSuccess: () => toast.success("已保存 ✿"),
    onError: () => toast.error("保存失败"),
  });
  const sync = useMutation({
    ...trpc.maimai.sync.mutationOptions(),
    onSuccess: (r) => toast.success(`同步成功：${r.nickname} · rating ${r.rating} · ${r.count} 谱面 ✿`),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold">舞萌 · 查分器对接</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        配置水鱼 / 落雪账号后点「同步」，成绩会拉进本地库，前台 /maimai 展示 b50 与全部成绩。
      </p>

      <Card className="mt-4">
        <CardBody className="space-y-4">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-muted-foreground">数据源</span>
            <div className="flex gap-2">
              {(["diving-fish", "lxns"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSource(s)}
                  className={`rounded-pill px-4 py-1.5 text-sm font-medium transition ${
                    source === s ? "bg-primary text-primary-foreground" : "bg-soft text-muted-foreground"
                  }`}
                >
                  {s === "diving-fish" ? "水鱼" : "落雪"}
                </button>
              ))}
            </div>
          </div>

          {source === "diving-fish" ? (
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-muted-foreground">水鱼用户名 *</span>
                <input value={df} onChange={(e) => setDf(e.target.value)} placeholder="diving-fish 用户名" className={input} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-muted-foreground">Import-Token（可选，拉全部成绩用）</span>
                <input value={dfToken} onChange={(e) => setDfToken(e.target.value)} placeholder="不填则只同步 b50" className={input} />
              </label>
              <p className="text-xs text-muted-foreground">b50 走公开查询（需你在水鱼里未开隐私）。Import-Token 在水鱼「账号详情」生成。</p>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-muted-foreground">落雪个人 API 密钥 *</span>
                <input value={lx} onChange={(e) => setLx(e.target.value)} placeholder="lxns 个人 API 密钥" className={input} />
              </label>
              <p className="text-xs text-muted-foreground">在落雪「账号详情 → 个人 API 密钥」获取，读你自己的成绩，无需好友码。</p>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() =>
                save.mutate({
                  source,
                  divingFishUsername: df,
                  divingFishImportToken: dfToken,
                  lxnsPersonalToken: lx,
                })
              }
              disabled={save.isPending}
              variant="soft"
            >
              {save.isPending ? "保存中…" : "保存配置"}
            </Button>
            <Button onClick={() => sync.mutate(undefined)} disabled={sync.isPending}>
              {sync.isPending ? "同步中…" : "立即同步"}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
