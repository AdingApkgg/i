"use client";

import { Button } from "@i/ui";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

const input =
  "w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

/** Inline sign-in / sign-up for visitors who want to comment. */
export function VisitorAuth() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const res =
      mode === "in"
        ? await authClient.signIn.email({ email, password })
        : await authClient.signUp.email({
            email,
            password,
            name: name || email.split("@")[0] || "访客",
          });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message ?? (mode === "in" ? "登录失败" : "注册失败"));
      return;
    }
    toast.success(mode === "in" ? "已登录 ✿" : "注册成功 ✿");
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-[var(--radius-lg)] border border-border bg-soft/40 p-4">
      <div className="text-sm text-muted-foreground">
        {mode === "in" ? "登录后即可评论" : "注册一个访客账号"}
      </div>
      {mode === "up" && (
        <input placeholder="昵称" value={name} onChange={(e) => setName(e.target.value)} className={input} />
      )}
      <input type="email" placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} required className={input} />
      <input type="password" placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} required className={input} />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "…" : mode === "in" ? "登录" : "注册"}
        </Button>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-primary"
          onClick={() => setMode(mode === "in" ? "up" : "in")}
        >
          {mode === "in" ? "没有账号？去注册" : "已有账号？去登录"}
        </button>
      </div>
    </form>
  );
}
