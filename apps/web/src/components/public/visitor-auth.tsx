import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@i/ui";
import { LogIn, UserRoundPlus } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FieldError } from "@/components/field-error";
import { authClient } from "@/lib/auth-client";
import { reportAuthError } from "@/lib/form";
import { signInSchema, signUpSchema } from "@/lib/schemas";

const input =
  "w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30 aria-invalid:border-destructive";

// 登录表单里昵称框不显示，形状和注册保持一致，方便两种模式共用一个表单
const visitorSignInSchema = signInSchema.extend({ name: signUpSchema.shape.name });

type Values = z.input<typeof signUpSchema>;

/** Inline sign-in / sign-up for visitors who want to comment. */
export function VisitorAuth() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const form = useForm<Values>({
    // 登录只校验邮箱 + 密码，注册多一个昵称和密码长度
    resolver: zodResolver(mode === "in" ? visitorSignInSchema : signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
  });
  const {
    register,
    handleSubmit,
    clearErrors,
    formState: { errors, isSubmitting },
  } = form;

  const submit = handleSubmit(async ({ name, email, password }) => {
    const { error } =
      mode === "in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({
            email,
            password,
            name: name || email.split("@")[0] || "访客",
          });
    if (error) {
      reportAuthError(error, form, mode === "in" ? "登录失败" : "注册失败");
      return;
    }
    toast.success(mode === "in" ? "已登录 ✿" : "注册成功 ✿");
  });

  return (
    <form
      noValidate
      onSubmit={submit}
      className="space-y-2 rounded-[var(--radius-lg)] border border-border bg-soft/40 p-4"
    >
      <div className="text-sm text-muted-foreground">
        {mode === "in" ? "登录后即可评论" : "注册一个访客账号"}
      </div>
      <AnimatePresence initial={false}>
        {mode === "up" && (
          <motion.div
            key="name"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <input
              placeholder="昵称"
              aria-invalid={errors.name ? true : undefined}
              {...register("name")}
              className={input}
            />
            <FieldError message={errors.name?.message} />
          </motion.div>
        )}
      </AnimatePresence>
      <div>
        <input
          type="email"
          placeholder="邮箱"
          autoComplete="email"
          aria-invalid={errors.email ? true : undefined}
          {...register("email")}
          className={input}
        />
        <FieldError message={errors.email?.message} />
      </div>
      <div>
        <input
          type="password"
          placeholder="密码"
          autoComplete={mode === "in" ? "current-password" : "new-password"}
          aria-invalid={errors.password ? true : undefined}
          {...register("password")}
          className={input}
        />
        <FieldError message={errors.password?.message} />
      </div>
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {mode === "in" ? <LogIn className="size-3.5" /> : <UserRoundPlus className="size-3.5" />}
          {isSubmitting ? "…" : mode === "in" ? "登录" : "注册"}
        </Button>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-primary"
          onClick={() => {
            clearErrors();
            setMode(mode === "in" ? "up" : "in");
          }}
        >
          {mode === "in" ? "没有账号？去注册" : "已有账号？去登录"}
        </button>
      </div>
    </form>
  );
}
