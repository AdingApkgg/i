import { Button, Card, CardBody } from "@i/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EntryEditor, fieldClass } from "@/components/bangumi/entry-editor";
import { SyncPreview } from "@/components/bangumi/sync-preview";
import { COLLECTION_LABELS } from "@/lib/bangumi/types";
import { client, orpc } from "@/lib/orpc/client";
import type { Resolutions } from "@/server/bangumi/service";
import type { RouterOutputs } from "@/server/router";

type Entry = RouterOutputs["bangumi"]["list"][number];
type Run = RouterOutputs["bangumi"]["run"];
const STATUS: Record<string, string> = {
  writing: "正在写入",
  pending: "待同步",
  synced: "已同步",
  conflict: "存在冲突",
  error: "同步失败",
  paused: "已暂停",
};
function parseSubject(text: string) {
  if (/^\d+$/.test(text.trim())) return Number(text.trim());
  try {
    const url = new URL(text.trim());
    if (["bgm.tv", "bangumi.tv", "chii.in"].includes(url.hostname)) {
      const id = /^\/subject\/(\d+)\/?$/.exec(url.pathname)?.[1];
      if (id) return Number(id);
    }
  } catch {}
  throw new Error("请输入 Bangumi 动画条目 ID 或条目链接");
}
export default function AnimeAdmin() {
  const qc = useQueryClient();
  const status = useQuery({ ...orpc.bangumi.status.queryOptions(), refetchInterval: 2000 });
  const list = useQuery(orpc.bangumi.list.queryOptions());
  const [runId, setRunId] = useState("");
  const run = useQuery({
    ...orpc.bangumi.run.queryOptions({ input: { id: runId } }),
    enabled: !!runId,
    refetchInterval: (q) => (q.state.data?.status === "running" ? 1000 : false),
  });
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [subject, setSubject] = useState(""),
    [editing, setEditing] = useState<Entry | null>(null);
  const active =
    !!status.data?.account?.activeRunId ||
    run.data?.status === "running" ||
    (!!runId && run.isPending) ||
    list.isFetching ||
    (!!status.data?.runs[0] &&
      !!run.data &&
      new Date(status.data.runs[0].createdAt).getTime() > new Date(run.data.createdAt).getTime());
  const refresh = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: orpc.bangumi.status.key() }),
      qc.invalidateQueries({ queryKey: orpc.bangumi.list.key() }),
    ]);
  }, [qc]);
  const observedStatus = run.data?.status;
  const observedId = run.data?.id;
  const observedTime = run.data ? new Date(run.data.createdAt).getTime() : null;
  const latest = status.data?.runs[0];
  const activeId = status.data?.account?.activeRunId;
  useEffect(() => {
    if (observedId && observedStatus && observedStatus !== "running") void refresh();
  }, [observedId, observedStatus, refresh]);
  useEffect(() => {
    if (activeId && activeId !== runId) {
      setRunId(activeId);
      return;
    }
    if (
      latest &&
      (!runId || (observedTime !== null && new Date(latest.createdAt).getTime() > observedTime))
    )
      setRunId(latest.id);
  }, [activeId, latest, runId, observedTime]);
  async function act(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
      await refresh();
    } catch (e) {
      const message = e instanceof Error ? e.message : "操作失败";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }
  const start = (work: () => Promise<Run>) =>
    void act(async () => {
      const result = await work();
      setRunId(result.id);
      await qc.invalidateQueries({ queryKey: orpc.bangumi.run.key() });
    });
  const apply = (choices: Resolutions) => start(() => client.bangumi.apply({ id: runId, choices }));
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">番剧 · Bangumi</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          单账号双向同步追番状态、逐集进度、评分与短评。首次演练只读，确认后才应用。
        </p>
      </div>
      {(error || status.error || list.error || run.error) && (
        <p role="alert" className="rounded-md bg-soft p-3 text-sm text-destructive">
          {error || status.error?.message || list.error?.message || run.error?.message}
        </p>
      )}
      <Card>
        <CardBody className="space-y-3">
          <h2 className="font-semibold">账号与同步</h2>
          {status.data?.configured ? (
            <p className="text-sm">
              Token 已在服务端配置
              {status.data.account?.userId
                ? ` · 绑定账号 ${status.data.account.username}（${status.data.account.userId}）`
                : " · 首次演练时验证账号"}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              尚未配置 Token。请在服务器环境设置 BANGUMI_ACCESS_TOKEN（需 write:collection
              权限），重启服务后再演练；无需在浏览器填写凭据。
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {status.data?.account?.initialized
              ? "首次同步已确认，编辑会加入同步队列。"
              : "首次同步尚未确认，当前不会自动推送追番记录。"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || active || !status.data?.configured}
              onClick={() => start(() => client.bangumi.preview())}
            >
              演练预览
            </Button>
            <Button
              variant="soft"
              disabled={
                busy || active || !status.data?.configured || !status.data.account?.initialized
              }
              onClick={() => start(() => client.bangumi.sync())}
            >
              立即同步
            </Button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={status.data?.account?.autoSync ?? false}
              disabled={busy || !status.data?.account?.initialized || !status.data.configured}
              onChange={(e) =>
                void act(async () => {
                  await client.bangumi.settings({ autoSync: e.target.checked });
                })
              }
            />
            每 10 分钟从 Bangumi 检查更新
          </label>
          {status.data?.account?.lastSyncedAt && (
            <p className="text-xs text-muted-foreground">
              最近同步：{new Date(status.data.account.lastSyncedAt).toLocaleString("zh-CN")}
            </p>
          )}
          {status.data?.account?.lastError && (
            <p className="text-sm text-destructive">{status.data.account.lastError}</p>
          )}
        </CardBody>
      </Card>
      {run.data && (
        <Card>
          <CardBody>
            <h2 className="font-semibold">{run.data.kind === "preview" ? "演练" : "同步"}进度</h2>
            <p role="status" className="mt-2 text-sm">
              {run.data.progress}
            </p>
            {run.data.error && (
              <p role="alert" className="mt-2 text-sm text-destructive">
                {run.data.error}
              </p>
            )}
          </CardBody>
        </Card>
      )}
      {run.data?.status === "ready" && (
        <SyncPreview key={run.data.id} run={run.data} busy={busy || active} onApply={apply} />
      )}
      <Card>
        <CardBody>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void act(async () => {
                await client.bangumi.add({ subjectId: parseSubject(subject) });
                setEditing(null);
                setSubject("");
                toast.success("已添加为私有想看，同步完成后可从列表编辑");
              });
            }}
          >
            <label className="min-w-0 flex-1 space-y-1 text-sm">
              添加番剧
              <input
                className={fieldClass}
                placeholder="条目 ID 或 https://bgm.tv/subject/…"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </label>
            <Button
              disabled={busy || active || !!editing || !status.data?.configured}
              type="submit"
            >
              添加追番
            </Button>
          </form>
          <p className="mt-2 text-xs text-muted-foreground">
            按条目 ID 关联，不会自动覆盖旧影视页。新条目默认私有、想看；首次确认后会同步到 Bangumi。
          </p>
        </CardBody>
      </Card>
      {editing &&
        list.data?.some(
          (row) => row.subjectId === editing.subjectId && row.revision !== editing.revision,
        ) && (
          <p role="alert" className="text-sm text-muted-foreground">
            该条目已有更新，当前输入仍保留。请取消后重新载入，核对最新记录再编辑。
          </p>
        )}
      {editing && (
        <EntryEditor
          key={`${editing.subjectId}-${editing.revision}`}
          entry={editing}
          busy={busy || active}
          onClose={() => setEditing(null)}
          onSave={(state) =>
            void act(async () => {
              await client.bangumi.update({
                subjectId: editing.subjectId,
                revision: editing.revision,
                state,
              });
              setEditing(null);
              toast.success("追番记录已保存，等待同步");
            })
          }
        />
      )}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">追番记录（{list.data?.length ?? 0}）</h2>
        <Button
          variant="soft"
          onClick={() => {
            setEditing(null);
            void refresh();
          }}
        >
          刷新记录
        </Button>
      </div>
      {!list.data?.length ? (
        <p className="text-sm text-muted-foreground">暂无追番记录，可先演练导入 Bangumi 收藏。</p>
      ) : (
        <div className="space-y-2">
          {list.data.map((entry) => (
            <Card key={entry.subjectId}>
              <CardBody>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-medium">
                      {entry.metadata.nameCn || entry.metadata.name}
                      {entry.state.private ? " · 私有" : ""}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {COLLECTION_LABELS[entry.state.type]} · 已看{" "}
                      {Object.values(entry.state.episodes).filter((type) => type === 2).length}{" "}
                      个章节 · 我的评分 {entry.state.rate || "未评"} ·{" "}
                      {STATUS[entry.syncStatus] ?? entry.syncStatus}
                    </p>
                    {entry.syncError && (
                      <p className="mt-1 text-xs text-destructive">{entry.syncError}</p>
                    )}
                  </div>
                  <Button
                    variant="soft"
                    disabled={busy || active}
                    onClick={() => setEditing(entry)}
                  >
                    编辑 {entry.metadata.nameCn || entry.metadata.name}
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        有冲突或远端取消收藏时，重新演练并选择处理方式。部分失败会保留本站修改，成功记录不会回退；可重新同步。
      </p>
    </div>
  );
}
