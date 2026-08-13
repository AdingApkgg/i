import { TRPCClientError } from "@trpc/client";

/**
 * 把 tRPC 错误转成能直接 toast 的人话。zod 校验失败时 err.message 是一整串
 * JSON issues，不能直接展示；这里按字段映射成友好文案。
 */
export function trpcErrText(
  err: unknown,
  fallback: string,
  labels: Record<string, string> = {},
): string {
  if (err instanceof TRPCClientError) {
    const zodError = (err.data as { zodError?: { fieldErrors?: Record<string, string[]> } } | null)
      ?.zodError;
    const entry =
      zodError?.fieldErrors &&
      Object.entries(zodError.fieldErrors).find(([, msgs]) => msgs && msgs.length > 0);
    if (entry) return labels[entry[0]] ?? `「${entry[0]}」格式不对，检查一下～`;
  }
  if (err instanceof Error && err.message && !err.message.trimStart().startsWith("[")) {
    return err.message;
  }
  return fallback;
}
