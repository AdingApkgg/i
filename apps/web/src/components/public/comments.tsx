"use client";

import { Button, Card, CardBody } from "@i/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Send, Trash2 } from "lucide-react";
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
  const { data: session } = useSession();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const listOpts = trpc.comment.list.queryOptions({ path });
  const { data: comments = [], isLoading } = useQuery(listOpts);
  const [text, setText] = useState("");

  const create = useMutation({
    ...trpc.comment.create.mutationOptions(),
    onSuccess: () => {
      setText("");
      void qc.invalidateQueries({ queryKey: listOpts.queryKey });
    },
    onError: () => toast.error("发送失败"),
  });

  // 乐观删除：先从列表移除，失败自动回滚。
  // 不 spread mutationOptions()：它会把 context 类型钉死为 undefined，
  // 只取 mutationFn，让 context 从 onMutate 的返回值推断。
  const remove = useMutation({
    mutationFn: trpc.comment.remove.mutationOptions().mutationFn,
    onMutate: async ({ id }: { id: string }) => {
      await qc.cancelQueries({ queryKey: listOpts.queryKey });
      const prev = qc.getQueryData(listOpts.queryKey);
      qc.setQueryData(listOpts.queryKey, (cur) => cur?.filter((c) => c.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(listOpts.queryKey, ctx.prev);
      toast.error("删除失败");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: listOpts.queryKey }),
  });

  function send() {
    const contentMd = text.trim();
    if (!contentMd || create.isPending) return;
    create.mutate({ path, contentMd, postId });
  }

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
            <Button size="sm" disabled={create.isPending || !text.trim()} onClick={send}>
              <Send className="size-3.5" />
              {create.isPending ? "发送中…" : "发送"}
            </Button>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => void authClient.signOut().then(() => qc.clear())}
            >
              <LogOut className="size-3" />
              退出（{me.name ?? me.email}）
            </button>
          </div>
        </div>
      ) : (
        <VisitorAuth />
      )}

      <div className="mt-5 space-y-3">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {isLoading ? "评论加载中…" : "还没有评论，来说点什么吧 ✿"}
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {comments.map((c) => (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <Card>
                  <CardBody className="py-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold">{c.user?.name ?? "访客"}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{fmt(c.createdAt)}</span>
                        {(c.userId === me?.id || myRole === "admin" || myRole === "owner") && (
                          <button
                            type="button"
                            aria-label="删除评论"
                            className="hover:text-destructive"
                            onClick={() => remove.mutate({ id: c.id })}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
                      {c.contentMd}
                    </p>
                  </CardBody>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}
