import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, CardBody } from "@i/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FieldError } from "@/components/field-error";
import { reportSubmitError } from "@/lib/form";
import { orpc } from "@/lib/orpc/client";
import { MAIMAI_SOURCES, maimaiConfigSchema } from "@/lib/schemas";

const input =
  "w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 aria-invalid:border-destructive";

type Values = z.input<typeof maimaiConfigSchema>;
type Source = (typeof MAIMAI_SOURCES)[number];

export default function MaimaiAdmin() {
  const { data: cfg } = useQuery(orpc.maimai.config.queryOptions());
  const form = useForm<Values, unknown, z.output<typeof maimaiConfigSchema>>({
    resolver: zodResolver(maimaiConfigSchema),
    defaultValues: {
      source: "diving-fish",
      divingFishUsername: "",
      divingFishImportToken: "",
      lxnsPersonalToken: "",
    },
  });
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = form;
  const source = watch("source");

  // 配置加载完成后回填表单
  useEffect(() => {
    if (!cfg) return;
    reset({
      source: MAIMAI_SOURCES.includes(cfg.source as Source)
        ? (cfg.source as Source)
        : "diving-fish",
      divingFishUsername: cfg.divingFishUsername ?? "",
      divingFishImportToken: cfg.divingFishImportToken ?? "",
      lxnsPersonalToken: cfg.lxnsPersonalToken ?? "",
    });
  }, [cfg, reset]);

  const save = useMutation({
    ...orpc.maimai.saveConfig.mutationOptions(),
    onSuccess: () => toast.success("已保存 ✿"),
    onError: (e) => reportSubmitError(e, form, "保存失败"),
  });
  const submit = handleSubmit((values) => save.mutate(values));

  const sync = useMutation({
    ...orpc.maimai.sync.mutationOptions(),
    onSuccess: (r) =>
      toast.success(`同步成功：${r.nickname} · rating ${r.rating} · ${r.count} 谱面 ✿`),
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
                  onClick={() => setValue("source", s, { shouldDirty: true })}
                  className={`relative rounded-pill px-4 py-1.5 text-sm font-medium transition ${
                    source === s ? "text-primary-foreground" : "bg-soft text-muted-foreground"
                  }`}
                >
                  {source === s && (
                    <motion.span
                      layoutId="maimai-source-pill"
                      className="absolute inset-0 rounded-pill bg-primary"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10">{s === "diving-fish" ? "水鱼" : "落雪"}</span>
                </button>
              ))}
            </div>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {source === "diving-fish" ? (
              <motion.div
                key="diving-fish"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="space-y-3"
              >
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-muted-foreground">
                    水鱼用户名 *
                  </span>
                  <input
                    placeholder="diving-fish 用户名"
                    aria-invalid={errors.divingFishUsername ? true : undefined}
                    {...register("divingFishUsername")}
                    className={input}
                  />
                  <FieldError message={errors.divingFishUsername?.message} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-muted-foreground">
                    Import-Token（可选，拉全部成绩用）
                  </span>
                  <input
                    placeholder="不填则只同步 b50"
                    {...register("divingFishImportToken")}
                    className={input}
                  />
                </label>
                <p className="text-xs text-muted-foreground">
                  b50 走公开查询（需你在水鱼里未开隐私）。Import-Token 在水鱼「账号详情」生成。
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="lxns"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="space-y-3"
              >
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-muted-foreground">
                    落雪个人 API 密钥 *
                  </span>
                  <input
                    placeholder="lxns 个人 API 密钥"
                    aria-invalid={errors.lxnsPersonalToken ? true : undefined}
                    {...register("lxnsPersonalToken")}
                    className={input}
                  />
                  <FieldError message={errors.lxnsPersonalToken?.message} />
                </label>
                <p className="text-xs text-muted-foreground">
                  在落雪「账号详情 → 个人 API 密钥」获取，读你自己的成绩，无需好友码。
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2">
            <Button onClick={() => void submit()} disabled={save.isPending} variant="soft">
              {save.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {save.isPending ? "保存中…" : "保存配置"}
            </Button>
            <Button onClick={() => sync.mutate(undefined)} disabled={sync.isPending}>
              <RefreshCw className={`size-4 ${sync.isPending ? "animate-spin" : ""}`} />
              {sync.isPending ? "同步中…" : "立即同步"}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
