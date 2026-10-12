import { Button, Card } from "@i/ui";
import { useEffect } from "react";
import { Link } from "react-router";
import { waifuSay } from "@/lib/live2d/waifu";

const TIP = "呜……页面出错了，刷新一下试试？";

/** 前台页面渲染 / 加载出错时的兜底（外壳由前台布局的 ErrorBoundary 保留）。 */
export function ErrorView({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  useEffect(() => {
    console.error(error);
    waifuSay(TIP);
  }, [error]);
  const digest = (error as { digest?: string } | null)?.digest;

  return (
    <Card className="mx-auto max-w-lg" data-waifu-tip={TIP}>
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <div className="text-5xl">(；´Д｀)</div>
        <h1 className="text-lg font-semibold">页面出了点问题</h1>
        <p className="text-sm text-muted-foreground">可以重试一下，或者先回首页看看。</p>
        {digest && <p className="font-mono text-xs text-muted-foreground">错误编号：{digest}</p>}
        <div className="mt-4 flex gap-2">
          <Button onClick={onRetry}>重试</Button>
          <Button asChild variant="soft">
            <Link to="/">回首页</Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
