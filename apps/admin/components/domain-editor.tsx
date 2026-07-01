"use client";

import { apiRequest } from "@i/api-client";
import { Button, Card, Section } from "@i/ui";
import { useEffect, useState } from "react";
import { type DomainSpec, type FieldSpec, type Row } from "./domains";

const inputCls =
  "w-full rounded-card border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-accent focus:shadow-soft-sm";

/** Per-field form value: strings for text/select, number|null, or boolean. */
type FormValue = string | number | boolean | null;
type FormState = Record<string, FormValue>;

function initialValue(field: FieldSpec): FormValue {
  switch (field.type) {
    case "boolean":
      return false;
    case "number":
      return null;
    case "select":
      // Default a required select to its first option so it's never empty.
      return field.required ? (field.options?.[0] ?? "") : "";
    default:
      return "";
  }
}

function emptyForm(spec: DomainSpec): FormState {
  const out: FormState = {};
  for (const f of spec.fields) out[f.name] = initialValue(f);
  return out;
}

/** Hydrate the form from a fetched row, coercing to per-field shapes. */
function formFromRow(spec: DomainSpec, row: Row): FormState {
  const out: FormState = {};
  for (const f of spec.fields) {
    const raw = row[f.name];
    switch (f.type) {
      case "boolean":
        out[f.name] = Boolean(raw);
        break;
      case "number":
        out[f.name] = raw == null || raw === "" ? null : Number(raw);
        break;
      default:
        out[f.name] = raw == null ? "" : String(raw);
    }
  }
  return out;
}

/** Coerce the form to the JSON body the backend expects. */
function bodyFromForm(spec: DomainSpec, form: FormState): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const f of spec.fields) {
    const v = form[f.name];
    if (f.type === "number") {
      body[f.name] = v === "" || v == null ? null : Math.trunc(Number(v));
    } else if (f.type === "boolean") {
      body[f.name] = Boolean(v);
    } else {
      body[f.name] = v == null ? "" : String(v);
    }
  }
  return body;
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: FieldSpec;
  value: FormValue;
  onChange: (v: FormValue) => void;
}) {
  const label = (
    <span className="mb-1.5 block text-sm font-medium text-muted">
      {field.label}
      {field.required && <span className="ml-1 text-accent">*</span>}
    </span>
  );

  if (field.type === "boolean") {
    const on = Boolean(value);
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted">{field.label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={() => onChange(!on)}
          className={`relative h-6 w-11 shrink-0 rounded-pill transition ${on ? "bg-accent" : "bg-line"}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-soft-sm transition ${on ? "left-[22px]" : "left-0.5"}`}
          />
        </button>
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <label className="block sm:col-span-2">
        {label}
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className={`${inputCls} resize-y`}
        />
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <label className="block">
        {label}
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        >
          {!field.required && <option value="">—</option>}
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "number") {
    return (
      <label className="block">
        {label}
        <input
          type="number"
          value={value == null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          placeholder={field.placeholder}
          className={inputCls}
        />
      </label>
    );
  }

  // text
  return (
    <label className="block">
      {label}
      <input
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={inputCls}
      />
    </label>
  );
}

/**
 * Generic create/edit form built from a DomainSpec.
 *
 * Create → POST prefix. Edit → prefill by fetching the list (the domains have no
 * item-by-id GET) and finding the row, then PUT prefix/{id}. Numbers are coerced
 * to int|null, booleans to real booleans.
 */
export function DomainEditor({
  spec,
  id,
  onDone,
  onCancel,
}: {
  spec: DomainSpec;
  id?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const editing = id != null;
  const [form, setForm] = useState<FormState>(() => emptyForm(spec));
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const rows = await apiRequest<Row[]>("GET", spec.prefix);
        if (!alive) return;
        const row = rows.find((r) => r.id === id);
        if (!row) {
          setError("未找到该记录");
        } else {
          setForm(formFromRow(spec, row));
        }
      } catch {
        if (alive) setError("加载记录失败");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [editing, id, spec]);

  function set(name: string, v: FormValue) {
    setForm((prev) => ({ ...prev, [name]: v }));
  }

  async function save() {
    if (saving) return;
    // Validate required text/select fields are non-empty.
    for (const f of spec.fields) {
      if (!f.required) continue;
      const v = form[f.name];
      if (f.type === "text" || f.type === "textarea" || f.type === "select") {
        if (typeof v !== "string" || !v.trim()) {
          setError(`「${f.label}」不能为空`);
          return;
        }
      }
    }
    setError(null);
    setSaving(true);
    try {
      const body = bodyFromForm(spec, form);
      if (editing) await apiRequest("PUT", `${spec.prefix}/${id}`, body);
      else await apiRequest("POST", spec.prefix, body);
      onDone();
    } catch {
      setError("保存失败");
      setSaving(false);
    }
  }

  const heading = `${editing ? "编辑" : "新建"}${spec.label}`;

  if (loading) {
    return (
      <Section title={heading}>
        <Card className="text-sm text-muted">加载中…</Card>
      </Section>
    );
  }

  return (
    <Section title={heading} moreLabel="← 返回列表" onMore={onCancel}>
      <div className="space-y-4">
        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            {spec.fields.map((f) => (
              <FieldControl
                key={f.name}
                field={f}
                value={form[f.name] ?? initialValue(f)}
                onChange={(v) => set(f.name, v)}
              />
            ))}
          </div>
        </Card>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2">
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "保存中…" : editing ? "保存修改" : "创建"}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            取消
          </Button>
        </div>
      </div>
    </Section>
  );
}
