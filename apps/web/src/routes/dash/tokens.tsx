/**
 * AI 接入：签发 / 撤销 API token，并给出 MCP、OpenAPI 的地址与一段可直接粘给 AI 的说明。
 * 明文只在创建成功那一刻显示，之后只留前缀。
 */
import { Button, Card, CardBody, cn } from "@i/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, LoaderCircle, ShieldCheck, ShieldOff, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { inputCls } from "@/components/dash/domain-admin";
import { orpc } from "@/lib/orpc/client";

const fmt = (value: string | Date | null) => {
  if (!value) return "—";
  const t = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toLocaleString("zh-CN", { hour12: false }) : "—";
};

const DAYS = [
  { value: "", label: "不过期" },
  { value: "7", label: "7 天" },
  { value: "30", label: "30 天" },
  { value: "90", label: "90 天" },
  { value: "365", label: "1 年" },
];

const ORIGIN = "https://i.saop.cc";

const prompt = `你通过 i 站的管理接口干活。
- 工具：MCP 端点 ${ORIGIN}/api/mcp（HTTP POST，JSON-RPC，请求头 Authorization: Bearer <token>）
- 先 tools/list，工具名形如 <分组>_<动作>；写之前先读，改完再读一次确认
- 也可以用普通 HTTP：POST ${ORIGIN}/api/rpc/<分组>/<动作>，JSON body，同样的 Bearer
- 完整描述：${ORIGIN}/api/openapi.json
- 图片先 POST ${ORIGIN}/api/gallery/upload（multipart: file）拿 imageUrl，再写进封面字段，不要手拼 CAS key`;

export default function TokensPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [scope, setScope] = useState<"read" | "write">("read");
  const [days, setDays] = useState("");
  const [secret, setSecret] = useState<string | null>(null);

  const list = useQuery(orpc.apiToken.list.queryOptions());
  const items = list.data?.items ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: orpc.apiToken.list.key() });

  const create = useMutation({
    mutationFn: orpc.apiToken.create.mutationOptions().mutationFn,
    onSuccess: async (data) => {
      setSecret(data.secret);
      setName("");
      toast.success("已签发 ✿ 明文只显示这一次");
      await invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: orpc.apiToken.revoke.mutationOptions().mutationFn,
    onSuccess: async () => {
      toast.success("已撤销");
      await invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: orpc.apiToken.delete.mutationOptions().mutationFn,
    onSuccess: async () => {
      toast.success("已删除");
      await invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  async function copy(text: string, tip: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(tip);
    } catch {
      toast.error("复制失败，手动选中吧");
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold sm:text-2xl">AI 接入</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        给自己和 AI 用的管理凭据。只读 token 只能查，写操作会被拒；明文只在创建时出现一次。
      </p>

      <Card className="mt-4">
        <CardBody className="space-y-3">
          <div className="font-semibold">怎么接</div>
          <p className="text-sm text-muted-foreground">
            把下面这段连同 token 一起给 AI，它就有完整的接入方式；MCP 客户端直接填{" "}
            <code className="rounded bg-muted px-1">{ORIGIN}/api/mcp</code>。
          </p>
          <pre className="max-h-56 overflow-auto rounded-[var(--radius-md)] border border-border bg-muted/40 p-3 text-xs leading-relaxed">
            {prompt}
          </pre>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void copy(prompt, "接入说明已复制")}>
              <Copy className="size-3.5" /> 复制说明
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void copy(`${ORIGIN}/api/openapi.json`, "描述地址已复制")}
            >
              <Copy className="size-3.5" /> 复制 OpenAPI 地址
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardBody className="space-y-3">
          <div className="font-semibold">新建 token</div>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return toast.error("先起个名字，方便以后认出它");
              create.mutate({
                name: name.trim(),
                scope,
                expiresInDays: days ? Number(days) : undefined,
              });
            }}
          >
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="用途，如「pi 本机」"
              maxLength={60}
              className={cn(inputCls, "min-w-40 flex-1")}
            />
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as "read" | "write")}
              className={cn(inputCls, "w-auto")}
            >
              <option value="read">只读</option>
              <option value="write">可写</option>
            </select>
            <select
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className={cn(inputCls, "w-auto")}
            >
              {DAYS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <KeyRound className="size-4" />
              )}
              签发
            </Button>
          </form>
          {secret && (
            <div className="rounded-[var(--radius-md)] border border-primary/40 bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground">新 token（关掉就不再显示）</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all text-xs">{secret}</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void copy(secret, "token 已复制")}
                >
                  <Copy className="size-3.5" /> 复制
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="mt-4">
        <CardBody className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold">已签发</span>
            <span className="text-xs text-muted-foreground">
              有效 {list.data?.activeCount ?? 0} / {list.data?.limit ?? 20}
            </span>
          </div>
          {list.isPending ? (
            <p className="text-sm text-muted-foreground">读取中…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">还没有 token</p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((t) => {
                const dead = Boolean(t.revokedAt);
                return (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm"
                  >
                    <span
                      className={cn("font-medium", dead && "text-muted-foreground line-through")}
                    >
                      {t.name}
                    </span>
                    <code className="text-xs text-muted-foreground">{t.prefix}…</code>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs",
                        t.scope === "write"
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {t.scope === "write" ? "可写" : "只读"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      用过 {fmt(t.lastUsedAt)} · 到期 {fmt(t.expiresAt)}
                    </span>
                    <span className="ml-auto flex items-center gap-1">
                      {dead ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={remove.isPending}
                          onClick={() => remove.mutate({ id: t.id })}
                        >
                          <Trash2 className="size-3.5" /> 删除
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={revoke.isPending}
                          onClick={() => revoke.mutate({ id: t.id })}
                        >
                          {t.scope === "write" ? (
                            <ShieldOff className="size-3.5" />
                          ) : (
                            <ShieldCheck className="size-3.5" />
                          )}
                          撤销
                        </Button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
