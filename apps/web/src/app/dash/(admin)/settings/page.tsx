"use client";

import { Button, Card, CardBody } from "@i/ui";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";

const input =
  "w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30";

export default function SettingsPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (next.length < 6) {
      toast.error("新密码至少 6 位");
      return;
    }
    setBusy(true);
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message ?? "修改失败");
      return;
    }
    setCurrent("");
    setNext("");
    toast.success("密码已修改 ✿");
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold">设置</h1>
      <Card className="mt-4">
        <CardBody className="space-y-3">
          <div className="font-semibold">修改密码</div>
          <form onSubmit={submit} className="space-y-3">
            <input type="password" placeholder="当前密码" value={current} onChange={(e) => setCurrent(e.target.value)} required className={input} />
            <input type="password" placeholder="新密码（≥6 位）" value={next} onChange={(e) => setNext(e.target.value)} required className={input} />
            <Button type="submit" disabled={busy}>
              {busy ? "修改中…" : "修改密码"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
