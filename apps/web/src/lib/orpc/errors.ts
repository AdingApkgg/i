import { fallbackORPCErrorMessage, ORPCError } from "@orpc/client";

/** 服务端没给自定义 message 时的中文兜底（默认 message 是英文）。 */
const CODE_TEXT: Record<string, string> = {
  UNAUTHORIZED: "请先登录",
  FORBIDDEN: "没有权限",
  NOT_FOUND: "记录不存在",
  TOO_MANY_REQUESTS: "操作太频繁，稍后再试",
};

/** Standard Schema issue 的 path 段可能是裸 key 或 `{ key }`。 */
function firstField(issues: unknown): string | null {
  if (!Array.isArray(issues)) return null;
  for (const issue of issues as { path?: unknown[] }[]) {
    const seg = issue?.path?.[0];
    const key = typeof seg === "object" && seg !== null ? (seg as { key?: unknown }).key : seg;
    if (typeof key === "string" || typeof key === "number") return String(key);
  }
  return null;
}

/**
 * 把 oRPC 错误转成能直接 toast 的人话。输入校验失败时 message 是英文的
 * 「Input validation failed」，这里按字段映射成友好文案。
 */
export function orpcErrText(
  err: unknown,
  fallback: string,
  labels: Record<string, string> = {},
): string {
  if (!(err instanceof ORPCError)) return fallback;
  const field = firstField((err.data as { issues?: unknown } | undefined)?.issues);
  if (field) return labels[field] ?? `「${field}」格式不对，检查一下～`;
  // 自定义 message（业务错误，均为中文）直接展示；默认英文 message 换成中文兜底
  if (err.message && err.message !== fallbackORPCErrorMessage(err.code, undefined)) {
    return err.message;
  }
  return CODE_TEXT[err.code] ?? fallback;
}
