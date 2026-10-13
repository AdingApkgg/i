/** 表单字段下方的错误提示（react-hook-form 的 errors.x?.message） */
export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-destructive">
      {message}
    </p>
  );
}
