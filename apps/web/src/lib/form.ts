/**
 * react-hook-form 的公共处理。校验规则见 lib/schemas.ts（zodResolver），
 * 这里负责把服务端的报错接回表单。
 */
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { orpcErrText, orpcFieldErrors } from "@/lib/orpc/errors";

/**
 * 提交失败：服务端输入校验错误挂到表单里对应的字段上（就地显示），
 * 其它错误（重名、权限、断网……）和挂不上字段的校验错误 toast 出来。
 */
export function reportSubmitError<T extends FieldValues>(
  err: unknown,
  form: Pick<UseFormReturn<T>, "setError" | "getValues">,
  fallback: string,
  labels?: Record<string, string>,
) {
  const fields = Object.keys(form.getValues());
  const issues = orpcFieldErrors(err, labels).filter((i) => fields.includes(i.field));
  for (const [n, i] of issues.entries()) {
    form.setError(
      i.field as Path<T>,
      { type: "server", message: i.message },
      { shouldFocus: n === 0 },
    );
  }
  if (issues.length === 0) toast.error(orpcErrText(err, fallback, labels));
}

/** better-auth 的错误码 → 中文提示，以及该挂到表单的哪个字段 */
const AUTH_ERRORS: Record<string, { field: string; message: string }> = {
  INVALID_EMAIL_OR_PASSWORD: { field: "password", message: "邮箱或密码不对" },
  INVALID_EMAIL: { field: "email", message: "邮箱格式不对，检查一下～" },
  INVALID_PASSWORD: { field: "currentPassword", message: "当前密码不对" },
  USER_ALREADY_EXISTS: { field: "email", message: "这个邮箱已经注册过了，直接登录吧" },
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: {
    field: "email",
    message: "这个邮箱已经注册过了，直接登录吧",
  },
  PASSWORD_TOO_SHORT: { field: "password", message: "密码至少 6 位" },
  PASSWORD_TOO_LONG: { field: "password", message: "密码太长啦" },
};

/**
 * better-auth 调用失败（{ error } 返回值）：认识的错误码挂到字段上，其余 toast。
 * rename 用来把通用字段名对到本表单的字段（如改密码表单里 password → newPassword）。
 */
export function reportAuthError<T extends FieldValues>(
  error: { code?: string; message?: string; status?: number },
  form: Pick<UseFormReturn<T>, "setError" | "getValues">,
  fallback: string,
  rename: Record<string, string> = {},
) {
  const known = error.code ? AUTH_ERRORS[error.code] : undefined;
  if (known) {
    const field = rename[known.field] ?? known.field;
    if (field in form.getValues()) {
      form.setError(
        field as Path<T>,
        { type: "server", message: known.message },
        { shouldFocus: true },
      );
      return;
    }
    toast.error(known.message);
    return;
  }
  toast.error(error.status === 429 ? "操作太频繁，稍后再试" : fallback);
}
