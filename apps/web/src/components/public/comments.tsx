"use client";

import { Button, Card, CardBody } from "@i/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { authClient, useSession } from "@/lib/auth-client";
import { useTRPC } from "@/lib/trpc/client";
import { VisitorAuth } from "./visitor-auth";

function fmt(d: string | Date) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(d),
  );
}

export function Comments({ path, postId }: { path: string; postId?: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { data: session } = useSession();
  const listOpts = trpc.comment.list.queryOptions({ path });
  const { data: comments = [] } = useQuery(listOpts);
  const [text, setText] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: listOpts.queryKey });

  const create = useMutation({
    ...trpc.comment.create.mutationOptions(),
    onSuccess: () => {
      setText("");
      invalidate();
    },
    onError: () => toast.error("发送失败"),
  });
  const remove = useMutation({
    ...trpc.comment.remove.mutationOptions(),
    onSuccess: invalidate,
  });

  const me = session?.user;
  const myRole = (me as { role?: string } | undefined)?.role;

  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-semibold">评论 · {comments.length}</h2>

      {me ? (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`以 ${me.name ?? me.email} 的身份评论…`}
            rows={3}
            className="w-full rounded-[var(--radius-md)] border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-ring/30"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={create.isPending || !text.trim()}
              onClick={() => create.mutate({ path, contentMd: text.trim(), postId })}
            >
              {create.isPending ? "发送中…" : "发送"}
            </Button>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-destructive"
              onClick={() => void authClient.signOut().then(() => qc.clear())}
            >
              退出（{me.name ?? me.email}）
            </button>
          </div>
        </div>
      ) : (
        <VisitorAuth />
      )}

      <div className="mt-5 space-y-3">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">还没有评论，来说点什么吧 ✿</p>
        ) : (
          comments.map((c) => (
            <Card key={c.id}>
              <CardBody className="py-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">{c.user?.name ?? "访客"}</div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{fmt(c.createdAt)}</span>
                    {(c.userId === me?.id || myRole === "admin" || myRole === "owner") && (
                      <button
                        type="button"
                        className="hover:text-destructive"
                        onClick={() => remove.mutate({ id: c.id })}
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">{c.contentMd}</p>
              </CardBody>
            </Card>
          ))
        )}
      </div>
    </section>
  );
}
