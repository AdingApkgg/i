import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, CardBody, cn } from "@i/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useId, useMemo, useRef, useState } from "react";
import { Controller, FormProvider, useForm, useFormContext } from "react-hook-form";
import { toast } from "sonner";
import { FieldError } from "@/components/field-error";
import { ADMIN_FIELDS, type FieldSpec } from "@/lib/admin-fields";
import {
  emptyForm,
  type FormValues,
  fieldLabels,
  fieldsSchema,
  rowToForm,
  toBody,
} from "@/lib/admin-form";
import { reportSubmitError } from "@/lib/form";
import { client } from "@/lib/orpc/client";
import { thumb } from "@/lib/thumb";

type Row = Record<string, unknown> & { id: string };

export const inputCls =
  "w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 aria-invalid:border-destructive";

export function DomainAdmin({
  domainKey,
  editorExtra,
}: {
  domainKey: string;
  editorExtra?: ReactNode;
}) {
  // The [domain] page already 404s unknown keys, so these are present.
  const spec = ADMIN_FIELDS[domainKey]!;
  // 按 domainKey 动态取路由（类型化的 client 只认字面量 key），这里收窄成通用 CRUD 形状
  const api = (
    client as unknown as Record<
      string,
      {
        list: (input?: unknown) => Promise<Row[]>;
        create: (b: unknown) => Promise<unknown>;
        update: (b: unknown) => Promise<unknown>;
        delete: (b: { id: string }) => Promise<unknown>;
      }
    >
  )[domainKey]!;

  const qc = useQueryClient();
  const listKey = ["admin-list", domainKey];
  const {
    data: rows = [],
    isLoading,
    isError,
  } = useQuery({ queryKey: listKey, queryFn: () => api.list(spec.listInput) });
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const schema = useMemo(() => fieldsSchema(spec.fields), [spec.fields]);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyForm(spec.fields),
  });
  const saving = form.formState.isSubmitting;

  function startEdit(target: Row | "new") {
    form.reset(target === "new" ? emptyForm(spec.fields) : rowToForm(spec.fields, target));
    setEditing(target);
  }

  const save = form.handleSubmit(async (values) => {
    try {
      const body = toBody(spec.fields, values);
      if (editing === "new") await api.create(body);
      else if (editing) await api.update({ ...body, id: editing.id });
      toast.success("已保存 ✿");
      setEditing(null);
      await qc.invalidateQueries({ queryKey: listKey });
    } catch (e) {
      // 字段校验错误挂到对应输入框；withDbErrors 的语义化错误（如「已存在同名记录」）toast
      reportSubmitError(e, form, "保存失败", fieldLabels(spec.fields));
    }
  });
  async function remove(row: Row) {
    if (!window.confirm("确定删除这条记录？")) return;
    // 乐观删除：先取消在途请求再从表格移除，失败回滚并提示。
    await qc.cancelQueries({ queryKey: listKey });
    const prev = qc.getQueryData<Row[]>(listKey);
    qc.setQueryData<Row[]>(listKey, (cur) => (cur ?? []).filter((r) => r.id !== row.id));
    try {
      await api.delete({ id: row.id });
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
          <Button onClick={() => startEdit("new")}>
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
              <FormProvider {...form}>
                <form noValidate onSubmit={save}>
                  <CardBody className="space-y-4">
                    {editorExtra}
                    <div className="grid gap-4 sm:grid-cols-2">
                      {spec.fields.map((f) => (
                        <Field key={f.name} field={f} />
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={saving}>
                        {saving && <LoaderCircle className="size-4 animate-spin" />}
                        {saving ? "保存中…" : editing === "new" ? "创建" : "保存修改"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setEditing(null)}
                        disabled={saving}
                      >
                        取消
                      </Button>
                    </div>
                  </CardBody>
                </form>
              </FormProvider>
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
                                onClick={() => startEdit(row)}
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

/** 通用编辑器的一个字段：取所在 <FormProvider> 的表单，按字段类型渲染控件 + 错误提示 */
export function Field({ field }: { field: FieldSpec }) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<FormValues>();
  const error = errors[field.name]?.message;
  const invalid = error ? true : undefined;
  const id = useId();
  const label = (
    <span className="mb-1 block text-sm font-medium text-muted-foreground">
      {field.label}
      {field.required && <span className="ml-1 text-primary">*</span>}
    </span>
  );

  if (field.type === "boolean") {
    return (
      <label className="flex items-center gap-3">
        <input type="checkbox" {...register(field.name)} />
        <span className="text-sm font-medium text-muted-foreground">{field.label}</span>
      </label>
    );
  }
  if (field.type === "image") {
    return (
      <Controller
        control={control}
        name={field.name}
        render={({ field: f }) => (
          <ImageField
            label={label}
            value={String(f.value ?? "")}
            onChange={f.onChange}
            onBlur={f.onBlur}
            placeholder={field.placeholder}
            error={error}
          />
        )}
      />
    );
  }

  return (
    <label htmlFor={id} className={cn("block", field.type === "textarea" && "sm:col-span-2")}>
      {label}
      {field.type === "textarea" ? (
        <textarea
          id={id}
          placeholder={field.placeholder}
          rows={5}
          readOnly={field.readOnly}
          aria-invalid={invalid}
          {...register(field.name)}
          className={cn(inputCls, "resize-y")}
        />
      ) : field.type === "select" ? (
        <select id={id} aria-invalid={invalid} {...register(field.name)} className={inputCls}>
          {!field.required && <option value="">—</option>}
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={field.type === "number" ? "number" : "text"}
          step={field.type === "number" ? "any" : undefined}
          readOnly={field.readOnly}
          placeholder={field.placeholder}
          aria-invalid={invalid}
          {...register(field.name)}
          className={inputCls}
        />
      )}
      <FieldError message={error} />
    </label>
  );
}

function ImageField({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  error,
}: {
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  placeholder?: string;
  error?: string;
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
          <img
            src={thumb(value, 320)}
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
            onBlur={onBlur}
            placeholder={placeholder}
            aria-invalid={error ? true : undefined}
            className={inputCls}
          />
          <FieldError message={error} />
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
              <LoaderCircle className="size-3.5 animate-spin" />
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
