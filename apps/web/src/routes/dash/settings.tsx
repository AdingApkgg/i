import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, CardBody } from "@i/ui";
import { KeyRound, LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FieldError } from "@/components/field-error";
import { authClient } from "@/lib/auth-client";
import { reportAuthError } from "@/lib/form";
import { changePasswordSchema } from "@/lib/schemas";

const input =
  "w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 aria-invalid:border-destructive";

const EMPTY = { currentPassword: "", newPassword: "" };

export default function SettingsPage() {
  const form = useForm<z.input<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting: busy },
  } = form;

  const submit = handleSubmit(async ({ currentPassword, newPassword }) => {
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    if (error) {
      reportAuthError(error, form, "修改失败", { password: "newPassword" });
      return;
    }
    reset(EMPTY);
    toast.success("密码已修改 ✿");
  });

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold">设置</h1>
      <Card className="mt-4">
        <CardBody className="space-y-3">
          <div className="font-semibold">修改密码</div>
          <form noValidate onSubmit={submit} className="space-y-3">
            <div>
              <input
                type="password"
                placeholder="当前密码"
                autoComplete="current-password"
                aria-invalid={errors.currentPassword ? true : undefined}
                {...register("currentPassword")}
                className={input}
              />
              <FieldError message={errors.currentPassword?.message} />
            </div>
            <div>
              <input
                type="password"
                placeholder="新密码（≥6 位）"
                autoComplete="new-password"
                aria-invalid={errors.newPassword ? true : undefined}
                {...register("newPassword")}
                className={input}
              />
              <FieldError message={errors.newPassword?.message} />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <KeyRound className="size-4" />
              )}
              {busy ? "修改中…" : "修改密码"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
