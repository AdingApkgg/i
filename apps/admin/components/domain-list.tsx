"use client";

import { apiRequest } from "@i/api-client";
import { Badge, Button, Card, Section } from "@i/ui";
import { useCallback, useEffect, useState } from "react";
import {
  type DomainSpec,
  fieldByName,
  isActiveStatus,
  type Row,
  titleField,
} from "./domains";

/** Truncate long cell text (e.g. moments content) for the table. */
function cell(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "boolean") return value ? "是" : "否";
  const s = String(value);
  return s.length > 48 ? `${s.slice(0, 48)}…` : s;
}

interface MonitorStatus {
  id: string;
  name: string;
  target: string;
  ok: boolean;
  status_code?: number | null;
  latency_ms?: number | null;
}

function MonitorStatusPanel() {
  const [rows, setRows] = useState<MonitorStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await apiRequest<MonitorStatus[]>("GET", "/api/monitor/status"));
    } catch {
      setError("加载监控状态失败");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Section title="实时状态" moreLabel="刷新" onMore={() => void load()}>
      {error && <Card className="border-red-300 text-sm text-red-500">{error}</Card>}
      {!error && rows == null && <Card className="text-sm text-muted">加载中…</Card>}
      {rows != null && rows.length === 0 && (
        <Card className="text-sm text-muted">暂无监控项。</Card>
      )}
      {rows != null && rows.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <Card key={r.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${r.ok ? "bg-green-500" : "bg-red-500"}`}
                  />
                  <span className="truncate font-medium text-ink">{r.name}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted">{r.target}</p>
              </div>
              <div className="shrink-0 text-right">
                <Badge variant={r.ok ? "accent" : "soft"}>{r.ok ? "正常" : "异常"}</Badge>
                <p className="mt-1 text-xs text-muted">
                  {r.latency_ms != null ? `${r.latency_ms}ms` : "—"}
                  {r.status_code != null ? ` · ${r.status_code}` : ""}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Section>
  );
}

/**
 * Generic list table built from a DomainSpec. Fetches rows via apiRequest, shows
 * key columns + a status Badge (when the domain has one) + edit/delete actions.
 */
export function DomainList({
  spec,
  onNew,
  onEdit,
}: {
  spec: DomainSpec;
  onNew: () => void;
  onEdit: (id: string) => void;
}) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await apiRequest<Row[]>("GET", spec.prefix));
    } catch {
      setError("加载失败");
    }
  }, [spec.prefix]);

  useEffect(() => {
    setRows(null);
    void load();
  }, [load]);

  const hasStatus = fieldByName(spec, "status") != null;
  const cols = spec.columns ?? spec.fields.slice(0, 2).map((f) => f.name);
  const label = titleField(spec);

  async function remove(row: Row) {
    const name = String(row[label.name] ?? row.id);
    if (!window.confirm(`确定删除「${name}」？此操作不可撤销。`)) return;
    setDeleting(row.id);
    try {
      await apiRequest("DELETE", `${spec.prefix}/${row.id}`);
      setRows((prev) => prev?.filter((r) => r.id !== row.id) ?? null);
    } catch {
      setError("删除失败");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      {spec.hasMonitorStatus && <MonitorStatusPanel />}

      <Section title={spec.label} moreLabel={`新建${spec.label}`} onMore={onNew}>
        {error && (
          <Card className="mb-4 border-red-300 text-sm text-red-500">
            {error}{" "}
            <button
              type="button"
              onClick={() => void load()}
              className="underline underline-offset-2"
            >
              重试
            </button>
          </Card>
        )}

        {rows == null && !error && <Card className="text-sm text-muted">加载中…</Card>}

        {rows != null && rows.length === 0 && (
          <Card className="flex flex-col items-center gap-3 py-10 text-center">
            <p className="text-sm text-muted">还没有{spec.label}记录。</p>
            <Button onClick={onNew}>新建{spec.label}</Button>
          </Card>
        )}

        {rows != null && rows.length > 0 && (
          <Card flush className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-muted">
                  {cols.map((name) => (
                    <th key={name} className="px-5 py-3 font-medium">
                      {fieldByName(spec, name)?.label ?? name}
                    </th>
                  ))}
                  {hasStatus && <th className="px-5 py-3 font-medium">状态</th>}
                  <th className="px-5 py-3 text-right font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-line transition last:border-0 hover:bg-soft/30"
                  >
                    {cols.map((name, i) => (
                      <td key={name} className="px-5 py-3">
                        {i === 0 ? (
                          <button
                            type="button"
                            onClick={() => onEdit(row.id)}
                            className="text-left font-medium text-ink hover:text-accent"
                          >
                            {cell(row[name])}
                          </button>
                        ) : (
                          <span className="text-muted">{cell(row[name])}</span>
                        )}
                      </td>
                    ))}
                    {hasStatus && (
                      <td className="px-5 py-3">
                        {(() => {
                          const s = String(row.status ?? "");
                          if (!s) return <span className="text-muted">—</span>;
                          return (
                            <Badge variant={isActiveStatus(s) ? "accent" : "soft"}>{s}</Badge>
                          );
                        })()}
                      </td>
                    )}
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="soft" size="sm" onClick={() => onEdit(row.id)}>
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:bg-red-50 hover:text-red-600"
                          disabled={deleting === row.id}
                          onClick={() => void remove(row)}
                        >
                          {deleting === row.id ? "删除中…" : "删除"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </Section>
    </>
  );
}
