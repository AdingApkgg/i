import { Button, Card } from "@i/ui";
import { useEffect } from "react";
import { Link } from "react-router";
import { waifuSay } from "@/lib/live2d/waifu";

const TIP = "诶？这里什么都没有哦……是不是走错路了呢 (｡•́︿•̀｡)";

/** 404 内容块：(site) 内 notFound() 与全站未匹配路由共用。 */
export function NotFoundView() {
  // 看板娘已在场（站内跳转）就直接吐槽；首屏由 data-waifu-tip 交给欢迎语
  useEffect(() => waifuSay(TIP), []);

  return (
    <Card className="mx-auto max-w-lg" data-waifu-tip={TIP}>
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <div className="text-6xl font-bold tracking-widest text-primary">404</div>
        <h1 className="text-lg font-semibold">这一页迷路了</h1>
        <p className="text-sm text-muted-foreground">链接可能已经失效，或者内容被搬到了别处 ✿</p>
        <div className="mt-4 flex gap-2">
          <Button asChild>
            <Link prefetch="intent" to="/">
              回首页
            </Link>
          </Button>
          <Button asChild variant="soft">
            <Link prefetch="intent" to="/blog">
              去看博客
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
