"use client";

import { Button, Card, CardBody } from "@i/ui";
import { AnimatePresence, motion } from "framer-motion";
import { Send } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-client";
import { useTRPCClient } from "@/lib/trpc/client";
import { trpcErrText } from "@/lib/trpc/errors";

const FIELD_HINTS = {
  url: "链接格式不对，要以 http(s):// 开头～",
  email: "邮箱格式不对，检查一下～",
  avatarUrl: "头像链接格式不对～",
  name: "名称为空或太长啦（50 字以内）",
  description: "描述太长啦（200 字以内）",
  message: "留言太长啦（500 字以内）",
};

const input =
  "w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30";

const EMPTY = { name: "", url: "", avatarUrl: "", description: "", email: "", message: "" };

/** 自助申请友链：匿名填邮箱，登录则沿用账号信息。 */
export function FriendApply({
  site,
}: {
  site: { name: string; url: string; description: string };
}) {
  const client = useTRPCClient();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);

  function openForm() {
    const u = session?.user;
    setForm((p) => ({
      ...p,
      name: p.name || u?.name || "",
      email: p.email || u?.email || "",
      avatarUrl: p.avatarUrl || u?.image || "",
    }));
    setOpen(true);
  }

  function set(k: keyof typeof EMPTY) {
    return (e: { target: { value: string } }) => setForm((p) => ({ ...p, [k]: e.target.value }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!form.name.trim() || !form.url.trim()) {
      toast.error("名称和链接是必填的");
      return;
    }
    if (!form.email.trim() && !session?.user) {
      toast.error("留个邮箱吧，审核结果会发过去 ✿");
      return;
    }
    // 少打协议头是常态，自动补 https://
    let url = form.url.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    setBusy(true);
    try {
      await client.friends.submit.mutate({
        name: form.name.trim(),
        url,
        avatarUrl: form.avatarUrl.trim() || undefined,
        description: form.description.trim() || undefined,
        email: form.email.trim() || undefined,
        message: form.message.trim() || undefined,
      });
      toast.success("已提交，通过审核后就会出现在这里 ✿");
      setForm(EMPTY);
      setOpen(false);
    } catch (err) {
      toast.error(trpcErrText(err, "提交失败，稍后再试", FIELD_HINTS));
    } finally {
      setBusy(false);
    }
  }

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
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              onSubmit={submit}
              className="grid gap-3 overflow-hidden sm:grid-cols-2"
            >
              <input
                placeholder="站点名称 *"
                value={form.name}
                onChange={set("name")}
                className={input}
              />
              <input
                placeholder="站点链接 * https://…"
                value={form.url}
                onChange={set("url")}
                className={input}
              />
              <input
                placeholder="头像链接 https://…"
                value={form.avatarUrl}
                onChange={set("avatarUrl")}
                className={input}
              />
              <input
                type="email"
                placeholder={session?.user ? "邮箱（默认用账号邮箱）" : "邮箱 *（接收审核结果）"}
                value={form.email}
                onChange={set("email")}
                className={input}
              />
              <input
                placeholder="一句话描述"
                value={form.description}
                onChange={set("description")}
                className="w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 sm:col-span-2"
              />
              <textarea
                placeholder="想对站长说的话（仅站长可见）"
                value={form.message}
                onChange={set("message")}
                rows={3}
                className="w-full resize-y rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/30 sm:col-span-2"
              />
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit" size="sm" disabled={busy}>
                  <Send className="size-3.5" />
                  {busy ? "提交中…" : "提交申请"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  disabled={busy}
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
