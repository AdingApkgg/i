import { Button, Card, CardBody } from "@i/ui";
import { useState } from "react";
import { COLLECTION_LABELS, type CollectionState, EPISODE_LABELS } from "@/lib/bangumi/types";
import type { RouterOutputs } from "@/server/router";
export const fieldClass =
  "w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm";
type Entry = RouterOutputs["bangumi"]["list"][number];
export function EntryEditor({
  entry,
  busy,
  onSave,
  onClose,
}: {
  entry: Entry;
  busy: boolean;
  onSave: (state: CollectionState) => void;
  onClose: () => void;
}) {
  const [state, setState] = useState(() => structuredClone(entry.state));
  const set = <K extends keyof CollectionState>(key: K, value: CollectionState[K]) =>
    setState((s) => ({ ...s, [key]: value }));
  return (
    <Card>
      <CardBody>
        <form
          aria-label="编辑番剧"
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(state);
          }}
        >
          <h2 className="text-lg font-semibold">{entry.metadata.nameCn || entry.metadata.name}</h2>
          {entry.paused && (
            <p className="text-sm text-muted-foreground">
              此条目已暂停同步；保存后可通过新的演练决定是否重新收藏。
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              追番状态
              <select
                className={fieldClass}
                value={state.type}
                onChange={(e) => set("type", Number(e.target.value))}
              >
                {Object.entries(COLLECTION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              个人评分
              <input
                type="number"
                className={fieldClass}
                min={0}
                max={10}
                step={1}
                required
                value={state.rate}
                onChange={(e) => set("rate", Number(e.target.value))}
              />
              <span className="text-xs text-muted-foreground">0 表示未评分</span>
            </label>
          </div>
          <label className="block space-y-1 text-sm">
            短评
            <textarea
              className={fieldClass}
              rows={3}
              maxLength={10000}
              value={state.comment}
              onChange={(e) => set("comment", e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={state.private}
              onChange={(e) => set("private", e.target.checked)}
            />
            私有收藏（不在前台展示）
          </label>
          <fieldset>
            <legend className="mb-2 font-medium">逐集进度</legend>
            <p className="mb-2 text-xs text-muted-foreground">
              正片与特别篇分别标记；修改整部状态会保留这里的逐集选择。
            </p>
            <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
              {entry.metadata.episodes.map((ep) => (
                <label
                  key={ep.id}
                  className="flex items-center justify-between gap-2 rounded-md bg-soft p-2 text-xs"
                >
                  <span className="min-w-0 flex-1">
                    {ep.type === 0 ? "第" : "特别篇 "} {ep.sort} {ep.type === 0 ? "集" : ""} ·{" "}
                    {ep.name || "未命名章节"}
                  </span>
                  <select
                    aria-label={`章节 ${ep.sort}：${ep.name || "未命名章节"}`}
                    className="rounded border border-border bg-background p-1"
                    value={state.episodes[ep.id] ?? 0}
                    onChange={(e) =>
                      set("episodes", { ...state.episodes, [ep.id]: Number(e.target.value) })
                    }
                  >
                    {Object.entries(EPISODE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} type="submit">
              {busy ? "保存中…" : "保存追番记录"}
            </Button>
            <Button variant="soft" disabled={busy} type="button" onClick={onClose}>
              取消编辑
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
