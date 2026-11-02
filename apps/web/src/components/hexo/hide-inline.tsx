import { useState } from "react";
import { cn } from "@i/ui";

/**
 * 行内剧透：正文默认藏起来，点一下才显示（Butterfly 的 {% hideInline %}）。
 * MDX 预处理器会输出 <HideInline text hint />，正文本身不参与 markdown 解析，
 * 因此这里只接受纯文本。
 */
export function HideInline({ text, hint }: { text?: string; hint?: string }) {
  const [shown, setShown] = useState(false);
  return (
    <button
      type="button"
      aria-pressed={shown}
      onClick={() => setShown((v) => !v)}
      className={cn(
        "mx-0.5 inline-flex items-baseline gap-1 rounded-[var(--radius-sm)] border border-dashed px-1.5 py-0.5 align-baseline text-sm transition",
        shown
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border bg-muted/60 text-muted-foreground hover:border-primary/40 hover:text-primary",
      )}
    >
      <span>{shown ? text || "…" : (hint || "点此显示")}</span>
    </button>
  );
}
