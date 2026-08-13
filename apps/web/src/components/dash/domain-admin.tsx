"use client";

import { Button, Card, CardBody, cn } from "@i/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";
import { toast } from "sonner";
import { ADMIN_FIELDS, type FieldSpec } from "@/lib/admin-fields";
import { useTRPCClient } from "@/lib/trpc/client";

type Row = Record<string, unknown> & { id: string };
type FormState = Record<string, unknown>;

function initial(f: FieldSpec): unknown {
  if (f.type === "boolean") return false;
  if (f.type === "number") return "";
  if (f.type === "select") return f.required ? (f.options?.[0] ?? "") : "";
  return "";
}
export function emptyForm(fields: FieldSpec[]): FormState {
  const o: FormState = {};
  for (const f of fields) o[f.name] = initial(f);
  return o;
}
export function rowToForm(fields: FieldSpec[], row: Row): FormState {
  const o: FormState = {};
  for (const f of fields) {
    const raw = row[f.name];
    if (f.type === "boolean") o[f.name] = Boolean(raw);
    else if (f.type === "number") o[f.name] = raw == null ? "" : String(raw);
    else o[f.name] = raw == null ? "" : String(raw);
  }
  return o;
}
export function toBody(fields: FieldSpec[], form: FormState): Record<string, unknown> {
  const b: Record<string, unknown> = {};
  for (const f of fields) {
    const v = form[f.name];
    if (f.type === "number") b[f.name] = v === "" || v == null ? null : Number(v);
    else if (f.type === "boolean") b[f.name] = Boolean(v);
    else b[f.name] = v == null ? "" : String(v);
  }
  return b;
}

export const inputCls =
  "w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30";

export function DomainAdmin({ domainKey }: { domainKey: string }) {
  // The [domain] page already 404s unknown keys, so these are present.
  const spec = ADMIN_FIELDS[domainKey]!;
  // tRPC vanilla client — dynamic router key access (typed router is per-literal).
  const client = useTRPCClient() as unknown as Record<
    string,
    {
      list: { query: () => Promise<Row[]> };
      create: { mutate: (b: unknown) => Promise<unknown> };
      update: { mutate: (b: unknown) => Promise<unknown> };
      delete: { mutate: (b: { id: string }) => Promise<unknown> };
    }
  >;
  const api = client[domainKey]!;

  const qc = useQueryClient();
  const listKey = ["admin-list", domainKey];
  const {
    data: rows = [],
    isLoading,
    isError,
  } = useQuery({ queryKey: listKey, queryFn: () => api.list.query() });
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [saving, setSaving] = useState(false);

  function set(name: string, v: unknown) {
    setForm((p) => ({ ...p, [name]: v }));
  }
  async function save() {
    if (saving) return;
    for (const f of spec.fields) {
      if (f.required && f.type !== "boolean" && f.type !== "number") {
        const v = form[f.name];
        if (typeof v !== "string" || !v.trim()) {
          toast.error(`「${f.label}」不能为空`);
          return;
        }
      }
    }
    setSaving(true);
    try {
      const body = toBody(spec.fields, form);
      if (editing === "new") await api.create.mutate(body);
      else if (editing) await api.update.mutate({ ...body, id: editing.id });
      toast.success("已保存 ✿");
      setEditing(null);
      await qc.invalidateQueries({ queryKey: listKey });
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  }
  async function remove(row: Row) {
    if (!window.confirm("确定删除这条记录？")) return;
    // 乐观删除：先取消在途请求再从表格移除，失败回滚并提示。
    await qc.cancelQueries({ queryKey: listKey });
    const prev = qc.getQueryData<Row[]>(listKey);
    qc.setQueryData<Row[]>(listKey, (cur) => (cur ?? []).filter((r) => r.id !== row.id));
    try {
      await api.delete.mutate({ id: row.id });
      void qc.invalidateQueries({ queryKey: listKey });
    } catch {
      qc.setQueryData(listKey, prev);
      toast.error("删除失败");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{spec.label}</h1>
        {editing == null && (
          <Button
            onClick={() => {
              setForm(emptyForm(spec.fields));
              setEditing("new");
            }}
          >
            <Plus className="size-4" /> 新建
          </Button>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {editing != null ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <Card className="mt-4">
              <CardBody className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  {spec.fields.map((f) => (
                    <Field
                      key={f.name}
                      field={f}
                      value={form[f.name]}
                      onChange={(v) => set(f.name, v)}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => void save()} disabled={saving}>
                    {saving && <Loader2 className="size-4 animate-spin" />}
                    {saving ? "保存中…" : editing === "new" ? "创建" : "保存修改"}
                  </Button>
                  <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
                    取消
                  </Button>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key="table"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <Card className="mt-4 overflow-hidden">
              {isLoading ? (
                <CardBody className="space-y-2.5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-9 animate-pulse rounded-[var(--radius-md)] bg-soft" />
                  ))}
                </CardBody>
              ) : isError ? (
                <CardBody className="text-sm text-muted-foreground">加载失败，刷新重试 ✿</CardBody>
              ) : rows.length === 0 ? (
                <CardBody className="text-sm text-muted-foreground">
                  还没有记录,点右上「+ 新建」添加 ✿
                </CardBody>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-border text-left text-xs text-muted-foreground">
                      <tr>
                        {spec.columns.map((c) => (
                          <th key={c} className="px-4 py-2.5 font-medium">
                            {spec.fields.find((f) => f.name === c)?.label ?? c}
                          </th>
                        ))}
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      <AnimatePresence initial={false}>
                        {rows.map((row) => (
                          <motion.tr
                            key={row.id}
                            layout
                            exit={{ opacity: 0 }}
                            className="border-b border-border/60 last:border-0 hover:bg-muted/40"
                          >
                            {spec.columns.map((c) => (
                              <td key={c} className="max-w-[16rem] truncate px-4 py-2.5">
                                {String(row[c] ?? "—")}
                              </td>
                            ))}
                            <td className="whitespace-nowrap px-4 py-2.5 text-right">
                              <button
                                type="button"
                                aria-label="编辑"
                                className="text-primary hover:underline"
                                onClick={() => {
                                  setForm(rowToForm(spec.fields, row));
                                  setEditing(row);
                                }}
                              >
                                <Pencil className="size-4" />
                              </button>
                              <button
                                type="button"
                                aria-label="删除"
                                className="ml-3 text-muted-foreground hover:text-destructive"
                                onClick={() => void remove(row)}
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </td>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Field({
  field,
  value,
  onChange,
}: {
  field: FieldSpec;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const label = (
    <span className="mb-1 block text-sm font-medium text-muted-foreground">
      {field.label}
      {field.required && <span className="ml-1 text-primary">*</span>}
    </span>
  );
  const wide = field.type === "textarea" ? "sm:col-span-2" : "";

  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="text-sm font-medium text-muted-foreground">{field.label}</span>
      </label>
    );
  }
  if (field.type === "textarea") {
    return (
      <label className={cn("block", wide)}>
        {label}
        <textarea
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={5}
          className={cn(inputCls, "resize-y")}
        />
      </label>
    );
  }
  if (field.type === "select") {
    return (
      <label className="block">
        {label}
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        >
          {!field.required && <option value="">—</option>}
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </label>
    );
  }
  if (field.type === "image") {
    return (
      <ImageField
        label={label}
        value={String(value ?? "")}
        onChange={onChange}
        placeholder={field.placeholder}
      />
    );
  }
  return (
    <label className="block">
      {label}
      <input
        type={field.type === "number" ? "number" : "text"}
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={inputCls}
      />
    </label>
  );
}

function ImageField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: ReactNode;
  value: string;
  onChange: (v: unknown) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function pick(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/gallery/upload", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      const { imageUrl } = (await res.json()) as { imageUrl: string };
      onChange(imageUrl);
      toast.success("上传成功 ✿");
    } catch {
      toast.error("上传失败");
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <label className="block sm:col-span-2">
      {label}
      <div className="flex items-start gap-3">
        {value ? (
          // biome-ignore lint/performance/noImgElement: 上传预览，沿用原生 img
          <img
            src={value}
            alt=""
            className="size-20 shrink-0 rounded-[var(--radius-md)] border border-border object-cover"
          />
        ) : (
          <div className="grid size-20 shrink-0 place-items-center rounded-[var(--radius-md)] border border-dashed border-border text-xs text-muted-foreground">
            无图
          </div>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={inputCls}
          />
          <input
            ref={ref}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void pick(e.target.files?.[0])}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => ref.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Upload className="size-3.5" />
            )}
            {uploading ? "上传中…" : "上传图片"}
          </Button>
        </div>
      </div>
    </label>
  );
}
