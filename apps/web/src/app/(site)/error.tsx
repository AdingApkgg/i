"use client";

import { Button, Card } from "@i/ui";
import Link from "next/link";
import { useEffect } from "react";
import { waifuSay } from "@/lib/live2d/waifu";

const TIP = "呜……页面出错了，刷新一下试试？";

/** 前台页面渲染出错时的兜底（外壳由 (site)/layout 保留）。 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
    waifuSay(TIP);
  }, [error]);

  return (
    <Card className="mx-auto max-w-lg" data-waifu-tip={TIP}>
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <div className="text-5xl">(；´Д｀)</div>
        <h1 className="text-lg font-semibold">页面出了点问题</h1>
        <p className="text-sm text-muted-foreground">可以重试一下，或者先回首页看看。</p>
        {error.digest && (
          <p className="font-mono text-xs text-muted-foreground">错误编号：{error.digest}</p>
        )}
        <div className="mt-4 flex gap-2">
          <Button onClick={reset}>重试</Button>
          <Button asChild variant="soft">
            <Link href="/">回首页</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
