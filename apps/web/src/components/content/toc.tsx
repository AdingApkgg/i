import { cn } from "@i/ui";
import { useEffect, useState } from "react";
import type { TocItem } from "@/lib/content/types";

/**
 * 文章目录：只在超宽屏（2xl）显示，贴在正文右侧并跟随滚动；当前阅读到的标题高亮。
 * 标题少于 3 个时不显示。
 */
export function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (items.length < 3) return;
    const els = items
      .map((i) => document.getElementById(i.id))
      .filter((e): e is HTMLElement => e != null);
    // 视口上方 1/3 处作为「正在读」的判定线
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) setActive(visible[0]!.target.id);
      },
      { rootMargin: "0px 0px -66% 0px" },
    );
    for (const el of els) io.observe(el);
    return () => io.disconnect();
  }, [items]);

  if (items.length < 3) return null;
  const minLevel = Math.min(...items.map((i) => i.level));
  return (
    <aside className="absolute top-0 left-full ml-10 hidden h-full w-44 2xl:block">
      <nav className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto text-sm">
        <div className="mb-2 text-xs font-medium tracking-wide text-muted-foreground">目录</div>
        <ul className="space-y-1.5 border-l border-border">
          {items.map((i) => (
            <li key={i.id}>
              <a
                href={`#${i.id}`}
                className={cn(
                  "-ml-px block border-l-2 py-0.5 pr-1 leading-snug transition",
                  active === i.id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                style={{ paddingLeft: `${(i.level - minLevel) * 0.75 + 0.75}rem` }}
              >
                {i.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
