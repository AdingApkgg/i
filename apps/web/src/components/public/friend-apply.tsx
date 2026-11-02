import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, CardBody, cn } from "@i/ui";
import { LoaderCircle, Send } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { FieldError } from "@/components/field-error";
import { useSession } from "@/lib/auth-client";
import { reportSubmitError } from "@/lib/form";
import { client } from "@/lib/orpc/client";
import { friendApplySchema } from "@/lib/schemas";

// 匿名访客必须留邮箱（审核结果发过去）；登录用户不填则沿用账号邮箱
const anonymousSchema = friendApplySchema.refine((v) => v.email, {
  message: "留个邮箱吧，审核结果会发过去 ✿",
  path: ["email"],
});

type FormIn = z.input<typeof friendApplySchema>;
type FormOut = z.output<typeof friendApplySchema>;

const EMPTY: FormIn = { name: "", url: "", avatarUrl: "", description: "", email: "", message: "" };

const input =
  "w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 aria-invalid:border-destructive";

/** 自助申请友链：匿名填邮箱，登录则沿用账号信息。 */
export function FriendApply({
  site,
}: {
  site: { name: string; url: string; description: string };
}) {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(session?.user ? friendApplySchema : anonymousSchema),
    defaultValues: EMPTY,
  });
  const {
    register,
    handleSubmit,
    reset,
    getValues,
    formState: { errors, isSubmitting },
  } = form;

  function openForm() {
    // 登录用户：空着的字段用账号信息预填
    const u = session?.user;
    const cur = getValues();
    reset({
      ...cur,
      name: cur.name || u?.name || "",
      email: cur.email || u?.email || "",
      avatarUrl: cur.avatarUrl || u?.image || "",
    });
    setOpen(true);
  }

  const submit = handleSubmit(async (values) => {
    try {
      await client.friends.submit(values);
      toast.success("已提交，通过审核后就会出现在这里 ✿");
      reset(EMPTY);
      setOpen(false);
    } catch (err) {
      reportSubmitError(err, form, "提交失败，稍后再试");
    }
  });

  const field = (
    name: keyof FormIn,
    placeholder: string,
    opts: { className?: string; type?: string } = {},
  ) => (
    <div className={opts.className}>
      <input
        type={opts.type ?? "text"}
        placeholder={placeholder}
        aria-invalid={errors[name] ? true : undefined}
        {...register(name)}
        className={input}
      />
      <FieldError message={errors[name]?.message} />
    </div>
  );

  return (
    <Card className="mt-8">
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">申请友链</div>
            <div className="text-xs text-muted-foreground">
              先把本站加进你的友链，再来提交申请～
            </div>
          </div>
          {!open && (
            <Button size="sm" onClick={openForm}>
              我要申请 ✿
            </Button>
          )}
        </div>

        <div className="rounded-[var(--radius-md)] bg-soft/50 p-3 font-mono text-xs leading-6 text-muted-foreground">
          <div>名称：{site.name}</div>
          <div>地址：{site.url}</div>
          <div>描述：{site.description}</div>
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.form
              key="apply-form"
              noValidate
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              onSubmit={submit}
              className="grid gap-3 overflow-hidden sm:grid-cols-2"
            >
              {field("name", "站点名称 *")}
              {field("url", "站点链接 * https://…")}
              {field("avatarUrl", "头像链接 https://…")}
              {field("email", session?.user ? "邮箱（默认用账号邮箱）" : "邮箱 *（接收审核结果）", {
                type: "email",
              })}
              {field("description", "一句话描述", { className: "sm:col-span-2" })}
              <div className="sm:col-span-2">
                <textarea
                  placeholder="想对站长说的话（仅站长可见）"
                  rows={3}
                  aria-invalid={errors.message ? true : undefined}
                  {...register("message")}
                  className={cn(input, "resize-y")}
                />
                <FieldError message={errors.message?.message} />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <LoaderCircle className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                  {isSubmitting ? "提交中…" : "提交申请"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  disabled={isSubmitting}
                >
                  收起
                </Button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </CardBody>
    </Card>
  );
}
