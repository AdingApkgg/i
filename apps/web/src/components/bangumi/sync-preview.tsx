import { Button, Card, CardBody } from "@i/ui";
import { useState } from "react";
import { mergeCollection, sameState } from "@/lib/bangumi/merge";
import { COLLECTION_LABELS, type CollectionState, EPISODE_LABELS } from "@/lib/bangumi/types";
import type { PreviewData, Run } from "@/server/bangumi/repository";
import type { Resolutions } from "@/server/bangumi/service";

function value(state: CollectionState | null, key: string) {
  if (!state) return "无收藏";
  if (key === "collection") return "保留本站收藏";
  if (key === "write")
    return `${COLLECTION_LABELS[state.type]} · ${state.rate || "未评分"} · ${Object.values(state.episodes).filter((t) => t === 2).length} 个章节看过`;
  if (key.startsWith("episodes.")) return EPISODE_LABELS[state.episodes[key.slice(9)] ?? 0];
  if (key === "type") return COLLECTION_LABELS[state.type];
  if (key === "private") return state.private ? "私有" : "公开";
  if (key === "rate") return state.rate ? `${state.rate} 分` : "未评分";
  return state.comment || "（空）";
}
const labels: Record<string, string> = {
  type: "追番状态",
  rate: "个人评分",
  comment: "短评",
  private: "隐私",
  collection: "远端已取消收藏",
  write: "上次写入结果未确认",
};
export function SyncPreview({
  run,
  busy,
  onApply,
}: {
  run: Run;
  busy: boolean;
  onApply: (choices: Resolutions) => void;
}) {
  const [choices, setChoices] = useState<Resolutions>({});
  if (run.status !== "ready" || !run.data) return null;
  const plan = run.data as PreviewData;
  const entries = plan.entries.map((item) => ({
    ...item,
    decision: mergeCollection(
      item.base,
      item.local,
      item.remote,
      choices[item.subjectId],
      item.uncertain,
    ),
  }));
  const conflicts = entries.reduce((n, e) => n + e.decision.conflicts.length, 0);
  const changed = entries.filter(
    (e) => !sameState(e.local, e.remote) || !sameState(e.base, e.local) || e.paused || e.uncertain,
  );
  const expired = new Date(run.expiresAt).getTime() <= Date.now();
  return (
    <Card>
      <CardBody className="space-y-3">
        <h2 className="text-lg font-semibold">首次／手动演练预览</h2>
        <p className="text-sm text-muted-foreground">
          以下内容尚未应用。确认时会重新检查双方数据，已变化的预览需要重新生成。
        </p>
        <p className="text-sm">
          扫描 {entries.length} 部 · 导入 {entries.filter((e) => !e.local && e.remote).length} 部 ·
          推送 {entries.filter((e) => e.decision.push).length} 部 · 待选择冲突 {conflicts} 项
        </p>
        <div className="max-h-[36rem] space-y-2 overflow-y-auto">
          {changed.map((item) => {
            const keys = [
              "type",
              "rate",
              "comment",
              "private",
              ...[
                ...new Set([
                  ...Object.keys(item.local?.episodes ?? {}),
                  ...Object.keys(item.remote?.episodes ?? {}),
                ]),
              ].map((id) => `episodes.${id}`),
            ];
            if (item.decision.missingRemote) keys.unshift("collection");
            if (item.uncertain) keys.unshift("write");
            const rawConflicts = mergeCollection(
              item.base,
              item.local,
              item.remote,
              {},
              item.uncertain,
            ).conflicts;
            const visible = keys.filter(
              (key) =>
                rawConflicts.includes(key) ||
                value(item.local, key) !== value(item.remote, key) ||
                (!item.base && !item.local),
            );
            return (
              <details
                key={item.subjectId}
                className="rounded-md border border-border p-3"
                open={rawConflicts.length > 0}
              >
                <summary className="cursor-pointer text-sm font-medium">
                  {item.metadata.nameCn || item.metadata.name} ·{" "}
                  {!item.local
                    ? "导入本站"
                    : !item.remote
                      ? item.base
                        ? "远端已取消"
                        : "新增到 Bangumi"
                      : item.decision.push && item.decision.pull
                        ? "双向合并"
                        : item.decision.push
                          ? "推送到 Bangumi"
                          : item.decision.pull
                            ? "更新本站"
                            : "确认基线"}
                  {item.paused ? " · 当前已暂停" : ""}
                </summary>
                <div className="mt-3 space-y-3">
                  {visible.map((key) => {
                    const ep = key.startsWith("episodes.")
                      ? item.metadata.episodes.find((e) => String(e.id) === key.slice(9))
                      : undefined;
                    const label = ep ? `章节 ${ep.sort} · ${ep.name}` : (labels[key] ?? key);
                    return (
                      <div key={key} className="rounded bg-soft p-2 text-xs">
                        <div className="mb-1 font-semibold">{label}</div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="whitespace-pre-wrap break-words">
                            本站：{value(item.local, key)}
                          </div>
                          <div className="whitespace-pre-wrap break-words">
                            Bangumi：{value(item.remote, key)}
                          </div>
                        </div>
                        {rawConflicts.includes(key) && (
                          <label className="mt-2 block">
                            冲突选择
                            <select
                              aria-label={`${item.subjectId} ${label} 冲突选择`}
                              className="ml-2 rounded border border-border bg-background p-1"
                              value={choices[item.subjectId]?.[key] ?? ""}
                              onChange={(e) =>
                                setChoices((prev) => ({
                                  ...prev,
                                  [item.subjectId]: {
                                    ...prev[item.subjectId],
                                    [key]: e.target.value as "local" | "remote",
                                  },
                                }))
                              }
                            >
                              <option value="">请选择</option>
                              <option value="local">
                                {key === "collection"
                                  ? "重新收藏到 Bangumi"
                                  : key === "write"
                                    ? "恢复本站完整目标"
                                    : "采用本站"}
                              </option>
                              <option value="remote">
                                {key === "collection"
                                  ? "保留本站并暂停同步"
                                  : key === "write" && !item.remote
                                    ? "保留本站并暂停同步"
                                    : "采用 Bangumi"}
                              </option>
                            </select>
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>
            );
          })}
        </div>
        {!changed.length && (
          <p className="text-sm text-muted-foreground">没有内容差异，确认后建立或核对同步基线。</p>
        )}
        <p className="text-xs text-muted-foreground">
          预览有效至 {new Date(run.expiresAt).toLocaleString("zh-CN")}
        </p>
        <Button disabled={busy || conflicts > 0 || expired} onClick={() => onApply(choices)}>
          {expired ? "预览已过期，请重新演练" : busy ? "处理中…" : "确认应用此预览"}
        </Button>
      </CardBody>
    </Card>
  );
}
