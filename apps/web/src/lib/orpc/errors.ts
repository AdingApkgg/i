import { fallbackORPCErrorMessage, ORPCError } from "@orpc/client";

/** 服务端没给自定义 message 时的中文兜底（默认 message 是英文）。 */
const CODE_TEXT: Record<string, string> = {
  UNAUTHORIZED: "请先登录",
  FORBIDDEN: "没有权限",
  NOT_FOUND: "记录不存在",
  TOO_MANY_REQUESTS: "操作太频繁，稍后再试",
};

/** 共用 schema（lib/schemas.ts）给的是中文文案；默认的英文文案不直接给人看 */
const isChinese = (s: unknown): s is string => typeof s === "string" && /[\u4e00-\u9fff]/.test(s);

export interface FieldIssue {
  field: string;
  message: string;
}

/**
 * 输入校验失败时逐字段取出提示：schema 自带的中文文案优先（lib/schemas.ts），
 * 默认的英文文案换成 labels 里的提示，都没有时给通用提示。不是校验错误返回空数组。
 * Standard Schema issue 的 path 段可能是裸 key 或 `{ key }`。
 */
export function orpcFieldErrors(err: unknown, labels: Record<string, string> = {}): FieldIssue[] {
  if (!(err instanceof ORPCError)) return [];
  const issues = (err.data as { issues?: unknown } | undefined)?.issues;
  if (!Array.isArray(issues)) return [];
  const out: FieldIssue[] = [];
  for (const issue of issues as { path?: unknown[]; message?: unknown }[]) {
    const seg = issue?.path?.[0];
    const key = typeof seg === "object" && seg !== null ? (seg as { key?: unknown }).key : seg;
    if (typeof key !== "string" && typeof key !== "number") continue;
    const field = String(key);
    if (out.some((i) => i.field === field)) continue;
    out.push({
      field,
      message: isChinese(issue.message)
        ? issue.message
        : (labels[field] ?? `「${field}」格式不对，检查一下～`),
    });
  }
  return out;
}

/**
 * 把 oRPC 错误转成能直接 toast 的人话。输入校验失败时 message 是英文的
 * 「Input validation failed」，这里换成第一个出错字段的提示。
 */
export function orpcErrText(
  err: unknown,
  fallback: string,
  labels: Record<string, string> = {},
): string {
  if (!(err instanceof ORPCError)) return fallback;
  const [first] = orpcFieldErrors(err, labels);
  if (first) return first.message;
  // 自定义 message（业务错误，均为中文）直接展示；默认英文 message 换成中文兜底
  if (err.message && err.message !== fallbackORPCErrorMessage(err.code, undefined)) {
    return err.message;
  }
  return CODE_TEXT[err.code] ?? fallback;
}
