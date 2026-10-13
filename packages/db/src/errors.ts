/**
 * 取 Postgres 错误码。drizzle 把驱动错误包在 DrizzleQueryError 里（原始 pg 错误在
 * `cause`），这里沿 cause 链找第一个带 SQLSTATE 的 `code`。
 */
export function pgErrorCode(e: unknown): string | null {
  for (let cur = e, depth = 0; cur && depth < 5; depth++) {
    const code = (cur as { code?: unknown }).code;
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) return code;
    cur = (cur as { cause?: unknown }).cause;
  }
  return null;
}

/** 常用 SQLSTATE。 */
export const PG = {
  uniqueViolation: "23505",
  foreignKeyViolation: "23503",
} as const;
