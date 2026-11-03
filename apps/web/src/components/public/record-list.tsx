/**
 * 记录型名单（视觉小说 / 东方等字段稀疏的收藏页）。
 * 数据大多是「标题 + 状态」，卡片式会把空白放大，所以走编号索引行：
 * 序号、可选封面、标题与徽记一行，其余元信息小字，长文本折叠。
 * 有 href 时整行可点（外链），行高固定不随内容跳。
 */
import type { ReactNode } from "react";
import { thumbProps } from "@/lib/thumb";

const TONE: Record<string, string> = {
  primary: "bg-primary/12 text-primary ring-primary/25",
  sky: "bg-sky-500/12 text-sky-600 ring-sky-500/25 dark:text-sky-300",
  amber: "bg-amber-500/12 text-amber-600 ring-amber-500/25 dark:text-amber-300",
  muted: "bg-soft text-muted-foreground ring-border",
};

export function RecordChip({
  children,
  tone = "muted",
}: {
  children?: ReactNode;
  tone?: keyof typeof TONE | string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-pill px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${TONE[tone] ?? TONE.muted}`}
    >
      {children}
    </span>
  );
}

export interface RecordRow {
  id: string;
  title: string;
  coverUrl?: string | null;
  chips?: ReactNode;
  rating?: number | null;
  meta?: ReactNode;
  facts?: ReactNode;
  body?: ReactNode;
  links?: ReactNode;
}

export function RecordList({ items, label }: { items: RecordRow[]; label: string }) {
  return (
    <ol aria-label={label} className="overflow-hidden rounded-xl border border-border bg-card/50">
      {items.map((item, index) => (
        <li key={item.id} className="group border-b border-border/60 last:border-b-0">
          <article className="flex gap-3 px-4 py-4 transition-colors group-hover:bg-soft/50 sm:gap-4 sm:px-5">
            <span
              aria-hidden="true"
              className="w-6 shrink-0 pt-1 font-serif text-sm italic tabular-nums text-muted-foreground transition-colors group-hover:text-primary"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            {item.coverUrl && (
              <img
                {...thumbProps(item.coverUrl, [320, 640], "56px")}
                alt=""
                loading="lazy"
                className="h-[74px] w-[56px] shrink-0 rounded-md object-cover ring-1 ring-border/60"
              />
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5">
                <h2 className="min-w-0 text-[15px] leading-snug font-semibold break-words">
                  {item.title}
                </h2>
                {item.chips}
                {item.rating != null && (
                  <span className="ml-auto shrink-0 font-serif text-sm italic tabular-nums text-primary">
                    {item.rating}
                    <span className="text-[11px] text-muted-foreground not-italic">/10</span>
                  </span>
                )}
              </div>
              {item.meta && (
                <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                  {item.meta}
                </p>
              )}
              {item.facts && (
                <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground">
                  {item.facts}
                </p>
              )}
              {item.body}
              {item.links && (
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">{item.links}</p>
              )}
            </div>
          </article>
        </li>
      ))}
    </ol>
  );
}

/** 行内小链接，保持主站绯红下划线的手感 */
export function RecordLink({ href, children }: { href: string; children?: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-primary hover:underline"
    >
      {children}
      <span aria-hidden="true">↗</span>
    </a>
  );
}
