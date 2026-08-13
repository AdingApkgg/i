"use client";

import { Button, Card, CardBody, cn } from "@i/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Mail, Pencil, Plus, RefreshCw, Trash2, UserRound, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC, useTRPCClient } from "@/lib/trpc/client";
import { trpcErrText } from "@/lib/trpc/errors";
import type { AppRouter } from "@/server/root";

type FriendRow = inferRouterOutputs<AppRouter>["friends"]["adminList"][number];

const inputCls =
  "w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30";

const STATUS_META: Record<string, { label: string; cls: string }> = {
  active: { label: "已通过", cls: "bg-emerald-500/10 text-emerald-600" },
  pending: { label: "待审核", cls: "bg-amber-500/10 text-amber-600" },
  rejected: { label: "已拒绝", cls: "bg-zinc-500/10 text-zinc-500" },
  outdate: { label: "失联", cls: "bg-rose-500/10 text-rose-600" },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, cls: "bg-soft text-muted-foreground" };
  return (
    <span className={cn("inline-flex rounded-pill px-2 py-0.5 text-[11px] font-medium", m.cls)}>
      {m.label}
    </span>
  );
}

function fmtTime(d: Date | string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** 存活 / 反链检测结果（反链仅供审核参考）。 */
function CheckInfo({ f }: { f: FriendRow }) {
  if (!f.checkedAt) return <span className="text-xs text-muted-foreground">未检测</span>;
  return (
    <div className="space-y-0.5 text-xs">
      <span
        className={
          f.reachable == null
            ? "text-muted-foreground"
            : f.reachable
              ? "text-emerald-600"
              : "text-rose-600"
        }
      >
        {f.reachable == null ? "存活未知" : f.reachable ? "存活" : `不可达 ×${f.failCount}`}
      </span>
      <span className="mx-1 text-muted-foreground">·</span>
      <span
        className={
          f.backlinked == null
            ? "text-muted-foreground"
            : f.backlinked
              ? "text-emerald-600"
              : "text-amber-600"
        }
      >
        {f.backlinked == null ? "反链未知" : f.backlinked ? "有反链" : "无反链"}
      </span>
      <div className="text-muted-foreground">{fmtTime(f.checkedAt)}</div>
    </div>
  );
}

function Avatar({ f, size = "size-9" }: { f: FriendRow; size?: string }) {
  return f.avatarUrl ? (
    // biome-ignore lint/performance/noImgElement: 外站头像，沿用原生 img
    <img src={f.avatarUrl} alt="" className={cn(size, "shrink-0 rounded-full object-cover")} />
  ) : (
    <div
      className={cn(
        size,
        "flex shrink-0 items-center justify-center rounded-full bg-soft text-primary/40",
      )}
    >
      <UserRound className="size-4" />
    </div>
  );
}

interface FormState {
  name: string;
  url: string;
  avatarUrl: string;
  description: string;
  group: string;
  email: string;
  status: string;
  sortOrder: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  url: "",
  avatarUrl: "",
  description: "",
  group: "",
  email: "",
  status: "active",
  sortOrder: "0",
};

export function FriendsAdmin() {
  const client = useTRPCClient();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const listOpts = trpc.friends.adminList.queryOptions();
  const { data: rows = [], isLoading: loading, isError } = useQuery(listOpts);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<FriendRow | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  // 待审核卡片上的分组草稿（通过时带上）。
  const [groupDraft, setGroupDraft] = useState<Record<string, string>>({});

  const pending = rows.filter((f) => f.status === "pending");
  const others = rows.filter((f) => f.status !== "pending");
  const groupNames = [...new Set(rows.map((f) => f.group).filter((g): g is string => Boolean(g)))];

  async function run(fn: () => Promise<unknown>, ok?: string) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      await qc.invalidateQueries({ queryKey: listOpts.queryKey });
    } catch (e) {
      toast.error(
        trpcErrText(e, "操作失败", {
          url: "链接格式不对，要以 http(s):// 开头",
          email: "邮箱格式不对",
          avatarUrl: "头像链接格式不对",
          name: "名称为空或太长（50 字以内）",
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  function review(f: FriendRow, action: "approve" | "reject") {
    void run(
      () =>
        client.friends.review.mutate({
          id: f.id,
          action,
          group: groupDraft[f.id]?.trim() || undefined,
        }),
      action === "approve" ? `已通过「${f.name}」✿` : `已拒绝「${f.name}」`,
    );
  }

  function checkOne(f: FriendRow) {
    void run(async () => {
      const r = await client.friends.check.mutate({ id: f.id });
      const c = r.friend;
      if (c) {
        if (c.reachable) {
          toast.success(`「${f.name}」存活${c.backlinked ? "，有反链 ✿" : "，没找到反链"}`);
        } else {
          toast.warning(`「${f.name}」不可达（连续 ${c.failCount} 次）`);
        }
      }
    });
  }

  function checkAll() {
    void run(async () => {
      const r = await client.friends.check.mutate({});
      toast.success(`已开始检测 ${r.queued} 条友链，稍后刷新查看结果`);
    });
  }

  function remove(f: FriendRow) {
    if (!window.confirm(`确定删除「${f.name}」？`)) return;
    void run(() => client.friends.delete.mutate({ id: f.id }), "已删除");
  }

  function startEdit(f: FriendRow | "new") {
    setForm(
      f === "new"
        ? EMPTY_FORM
        : {
            name: f.name,
            url: f.url,
            avatarUrl: f.avatarUrl ?? "",
            description: f.description ?? "",
            group: f.group ?? "",
            email: f.email ?? "",
            status: f.status,
            sortOrder: String(f.sortOrder),
          },
    );
    setEditing(f);
  }

  function save() {
    if (!form.name.trim() || !form.url.trim()) {
      toast.error("名称和链接不能为空");
      return;
    }
    const body = {
      name: form.name.trim(),
      url: form.url.trim(),
      avatarUrl: form.avatarUrl.trim(),
      description: form.description.trim(),
      group: form.group.trim(),
      email: form.email.trim(),
      status: form.status as "active" | "pending" | "rejected" | "outdate",
      sortOrder: Number(form.sortOrder) || 0,
    };
    void run(async () => {
      if (editing === "new") await client.friends.create.mutate(body);
      else if (editing) await client.friends.update.mutate({ ...body, id: editing.id });
      setEditing(null);
    }, "已保存 ✿");
  }

  const set = (k: keyof FormState) => (e: { target: { value: string } }) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">友链</h1>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={checkAll} disabled={busy}>
            <RefreshCw className={cn("size-3.5", busy && "animate-spin")} /> 全部检测
          </Button>
          {editing == null && (
            <Button size="sm" onClick={() => startEdit("new")}>
              <Plus className="size-3.5" /> 新建
            </Button>
          )}
        </div>
      </div>

      {/* ---- 编辑 / 新建 ---- */}
      <AnimatePresence initial={false}>
        {editing != null && (
          <motion.div
            key="friend-form"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <Card className="mt-4">
              <CardBody className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    placeholder="名称 *"
                    value={form.name}
                    onChange={set("name")}
                    className={inputCls}
                  />
                  <input
                    placeholder="链接 * https://…"
                    value={form.url}
                    onChange={set("url")}
                    className={inputCls}
                  />
                  <input
                    placeholder="头像链接"
                    value={form.avatarUrl}
                    onChange={set("avatarUrl")}
                    className={inputCls}
                  />
                  <input
                    placeholder="分组（如 朋友 / 收藏）"
                    list="friend-groups"
                    value={form.group}
                    onChange={set("group")}
                    className={inputCls}
                  />
                  <input
                    placeholder="邮箱（通知用，不公开）"
                    value={form.email}
                    onChange={set("email")}
                    className={inputCls}
                  />
                  <select value={form.status} onChange={set("status")} className={inputCls}>
                    {Object.entries(STATUS_META).map(([v, m]) => (
                      <option key={v} value={v}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="描述"
                    value={form.description}
                    onChange={set("description")}
                    className={cn(inputCls, "sm:col-span-2")}
                  />
                  <input
                    type="number"
                    placeholder="排序"
                    value={form.sortOrder}
                    onChange={set("sortOrder")}
                    className={inputCls}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={save} disabled={busy}>
                    {busy && <Loader2 className="size-3.5 animate-spin" />}
                    {editing === "new" ? "创建" : "保存修改"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditing(null)}
                    disabled={busy}
                  >
                    取消
                  </Button>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---- 待审核队列 ---- */}
      {pending.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">
            待审核 · {pending.length}
          </h2>
          <div className="space-y-3">
            {pending.map((f) => (
              <Card key={f.id}>
                <CardBody className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Avatar f={f} size="size-10" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{f.name}</span>
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-xs text-primary hover:underline"
                        >
                          {f.url}
                        </a>
                      </div>
                      {f.description && (
                        <div className="mt-0.5 text-xs text-muted-foreground">{f.description}</div>
                      )}
                      <div className="mt-1 text-xs text-muted-foreground">
                        {f.email && (
                          <span className="mr-3 inline-flex items-center gap-1">
                            <Mail className="size-3" /> {f.email}
                          </span>
                        )}
                        <span>{fmtTime(f.createdAt)} 申请</span>
                        {f.applicantId && <span className="ml-3">已登录用户</span>}
                      </div>
                      {f.message && (
                        <div className="mt-2 rounded-[var(--radius-md)] bg-soft/50 p-2 text-xs">
                          {f.message}
                        </div>
                      )}
                    </div>
                    <CheckInfo f={f} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      placeholder="分组（默认 朋友）"
                      list="friend-groups"
                      value={groupDraft[f.id] ?? ""}
                      onChange={(e) => setGroupDraft((p) => ({ ...p, [f.id]: e.target.value }))}
                      className={cn(inputCls, "w-44")}
                    />
                    <Button size="sm" onClick={() => review(f, "approve")} disabled={busy}>
                      <Check className="size-3.5" /> 通过
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => review(f, "reject")}
                      disabled={busy}
                    >
                      <X className="size-3.5" /> 拒绝
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => checkOne(f)} disabled={busy}>
                      <RefreshCw className="size-3.5" /> 检测
                    </Button>
                  </div>
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ---- 全部友链 ---- */}
      <Card className="mt-6 overflow-hidden">
        {loading ? (
          <CardBody className="space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-[var(--radius-md)] bg-soft" />
            ))}
          </CardBody>
        ) : isError ? (
          <CardBody className="text-sm text-muted-foreground">加载失败，刷新重试 ✿</CardBody>
        ) : others.length === 0 ? (
          <CardBody className="text-sm text-muted-foreground">还没有友链 ✿</CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 font-medium">友链</th>
                  <th className="px-4 py-2.5 font-medium">分组</th>
                  <th className="px-4 py-2.5 font-medium">状态</th>
                  <th className="px-4 py-2.5 font-medium">检测</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {others.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                  >
                    <td className="max-w-[20rem] px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar f={f} />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{f.name}</div>
                          <a
                            href={f.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block truncate text-xs text-muted-foreground hover:text-primary"
                          >
                            {f.url}
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">{f.group ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={f.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <CheckInfo f={f} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs">
                      <button
                        type="button"
                        aria-label="编辑"
                        className="text-primary hover:underline"
                        onClick={() => startEdit(f)}
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="检测"
                        className="ml-3 text-muted-foreground hover:text-primary"
                        onClick={() => checkOne(f)}
                      >
                        <RefreshCw className="size-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="删除"
                        className="ml-3 text-muted-foreground hover:text-destructive"
                        onClick={() => remove(f)}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <datalist id="friend-groups">
        {groupNames.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
    </div>
  );
}
