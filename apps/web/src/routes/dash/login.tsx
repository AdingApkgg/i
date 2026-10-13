import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, CardBody } from "@i/ui";
import { LoaderCircle, LogIn } from "lucide-react";
import { motion } from "motion/react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router";
import type { z } from "zod";
import { FieldError } from "@/components/field-error";
import { authClient } from "@/lib/auth-client";
import { reportAuthError } from "@/lib/form";
import { signInSchema } from "@/lib/schemas";
import { seo } from "@/lib/seo";
import type { Route } from "./+types/login";

const input =
  "w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40 aria-invalid:border-destructive";

export default function LoginPage() {
  const navigate = useNavigate();
  const form = useForm<z.input<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting: busy },
  } = form;

  const submit = handleSubmit(async ({ email, password }) => {
    const { error } = await authClient.signIn.email({ email, password });
    if (error) {
      reportAuthError(error, form, "登录失败，稍后再试");
      return;
    }
    navigate("/dash");
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="w-full"
      >
        <Card className="w-full">
          <CardBody className="p-7">
            <h1 className="text-xl font-bold">登录后台 ✿</h1>
            <p className="mt-1 text-sm text-muted-foreground">管理你的个人空间内容</p>
            <form noValidate onSubmit={submit} className="mt-5 space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-muted-foreground">邮箱</span>
                <input
                  type="email"
                  autoComplete="email"
                  aria-invalid={errors.email ? true : undefined}
                  {...register("email")}
                  className={input}
                />
                <FieldError message={errors.email?.message} />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-muted-foreground">密码</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={errors.password ? true : undefined}
                  {...register("password")}
                  className={input}
                />
                <FieldError message={errors.password?.message} />
              </label>
              <Button type="submit" disabled={busy} className="w-full" size="lg">
                {busy ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <LogIn className="size-4" />
                )}
                {busy ? "登录中…" : "登录"}
              </Button>
            </form>
          </CardBody>
        </Card>
      </motion.div>
    </main>
  );
}

export const meta: Route.MetaFunction = (args) => seo(args, { title: "登录", noindex: true });
