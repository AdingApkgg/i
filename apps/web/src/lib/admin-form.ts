/**
 * /dash 通用编辑器的表单逻辑（配合 lib/admin-fields.ts 的字段表）：
 * 字段表 → react-hook-form 的默认值 / zod 校验，表单值 ↔ 接口数据互转。
 * 表单里一律用字符串（数字框清空是 ""），提交时再转成接口要的类型。
 */
import { z } from "zod";
import type { FieldSpec } from "./admin-fields";

export type FormValues = Record<string, string | boolean>;

function initial(f: FieldSpec): string | boolean {
  if (f.type === "boolean") return false;
  if (f.type === "select") return f.required ? (f.options?.[0] ?? "") : "";
  return "";
}

export function emptyForm(fields: FieldSpec[]): FormValues {
  return Object.fromEntries(fields.map((f) => [f.name, initial(f)]));
}

export function rowToForm(fields: FieldSpec[], row: Record<string, unknown>): FormValues {
  return Object.fromEntries(
    fields.map((f) => {
      const raw = row[f.name];
      return [f.name, f.type === "boolean" ? Boolean(raw) : raw == null ? "" : String(raw)];
    }),
  );
}

/** 表单值 → 接口数据：数字框空着发 null（服务端视为清空 / 默认值） */
export function toBody(fields: FieldSpec[], form: FormValues): Record<string, unknown> {
  return Object.fromEntries(
    fields.map((f) => {
      const v = form[f.name];
      if (f.type === "number") return [f.name, v === "" || v == null ? null : Number(v)];
      if (f.type === "boolean") return [f.name, Boolean(v)];
      return [f.name, v == null ? "" : String(v)];
    }),
  );
}

/** 按字段表生成前端校验：必填不能为空、数字框只能填数字（服务端仍按各自的 schema 兜底） */
export function fieldsSchema(fields: FieldSpec[]) {
  const shape: Record<string, z.ZodType<string | boolean, string | boolean>> = {};
  for (const f of fields) {
    if (f.type === "boolean") {
      shape[f.name] = z.boolean();
    } else if (f.type === "number") {
      shape[f.name] = z
        .string()
        .trim()
        .refine((v) => (f.required ? v !== "" : true), `「${f.label}」不能为空`)
        .refine((v) => v === "" || Number.isFinite(Number(v)), `「${f.label}」要填数字`);
    } else {
      shape[f.name] = f.required
        ? z.string().refine((v) => v.trim() !== "", `「${f.label}」不能为空`)
        : z.string();
    }
  }
  return z.object(shape);
}

/** 服务端用默认英文报错的字段，换成带字段名的中文提示 */
export function fieldLabels(fields: FieldSpec[]): Record<string, string> {
  return Object.fromEntries(fields.map((f) => [f.name, `「${f.label}」格式不对，检查一下～`]));
}
