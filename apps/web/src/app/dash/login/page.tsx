"use client";

import { Button, Card, CardBody } from "@i/ui";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const { error } = await authClient.signIn.email({ email, password });
    setBusy(false);
    if (error) {
      toast.error(`登录失败：${error.message ?? "请检查邮箱和密码"}`);
      return;
    }
    router.push("/dash");
    router.refresh();
  }

  const input =
    "w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring/40";

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <Card className="w-full">
        <CardBody className="p-7">
          <h1 className="text-xl font-bold">登录后台 ✿</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理你的个人空间内容</p>
          <form onSubmit={submit} className="mt-5 space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-muted-foreground">邮箱</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={input}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-muted-foreground">密码</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className={input}
              />
            </label>
            <Button type="submit" disabled={busy} className="w-full" size="lg">
              {busy ? "登录中…" : "登录"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </main>
  );
}
