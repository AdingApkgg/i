/**
 * 记录型名单（视觉小说 / 东方等字段稀疏的收藏页）。
 * 数据大多是「标题 + 状态」，卡片式会把空白放大，所以走编号索引行：
 * 序号、可选封面、标题与徽记一行，其余元信息小字，长文本折叠。
 * 标题带 to 时指向站内详情页，外链（VNDB 等）仍走新标签页，行高固定不随内容跳。
 * columns 时改成两列卡片，行宽短一截不至于空得发慌；没有封面就用首字占位块，
 * 让有封面 / 无封面的行左缘对齐，不会参差。
 */
import type { ReactNode } from "react";
import { Link } from "react-router";
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
  /** 站内详情页地址；给了就把标题做成链接 */
  to?: string;
  /** 没有封面时占位块里的一个字 */
  initial?: string;
  coverUrl?: string | null;
  chips?: ReactNode;
  rating?: number | null;
  /** 标签 / 平台等短词，排在标题下方 */
  tags?: ReactNode;
  meta?: ReactNode;
  facts?: ReactNode;
  body?: ReactNode;
  links?: ReactNode;
}

export function RecordList({
  items,
  label,
  columns = false,
}: {
  items: RecordRow[];
  label: string;
  columns?: boolean;
}) {
  return (
    <ol
      aria-label={label}
      className={
        columns
          ? "grid grid-cols-1 gap-3 sm:grid-cols-2"
          : "overflow-hidden rounded-xl border border-border bg-card/50"
      }
    >
      {items.map((item, index) => (
        <li
          key={item.id}
          className={
            columns
              ? "group relative min-w-0 rounded-xl border border-border/70 bg-card/40 transition-colors hover:border-primary/35"
              : "group border-b border-border/60 last:border-b-0"
          }
        >
          <span
            aria-hidden="true"
            className={`absolute top-3 right-3 font-serif text-xs italic tabular-nums transition-colors group-hover:text-primary ${columns ? "text-muted-foreground/60" : "hidden"}`}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <article
            className={`relative flex gap-3 px-4 py-4 transition-colors group-hover:bg-soft/50 sm:gap-4 ${columns ? "" : "sm:px-5"}`}
          >
            {!columns && (
              <span
                aria-hidden="true"
                className="w-6 shrink-0 pt-1 font-serif text-sm italic tabular-nums text-muted-foreground transition-colors group-hover:text-primary"
              >
                {String(index + 1).padStart(2, "0")}
              </span>
            )}
            <span
              aria-hidden="true"
              className="absolute inset-y-3 left-0 w-px bg-primary/0 transition-colors group-hover:bg-primary/45"
            />
            {item.coverUrl ? (
              <img
                {...thumbProps(item.coverUrl, [320, 640], "68px")}
                alt=""
                loading="lazy"
                className="h-[90px] w-[68px] shrink-0 rounded-md object-cover ring-1 ring-border/60"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex h-[90px] w-[68px] shrink-0 items-center justify-center rounded-md border border-dashed border-border/80 bg-soft/40 font-serif text-2xl italic text-primary/30"
              >
                {(item.initial ?? item.title).slice(0, 1)}
              </span>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <div
                className={`flex flex-wrap items-baseline gap-x-2.5 gap-y-1.5 ${columns ? "pr-6" : ""}`}
              >
                <h2 className="min-w-0 text-[15px] leading-snug font-semibold wrap-anywhere">
                  {item.to ? (
                    <Link
                      to={item.to}
                      prefetch="intent"
                      className="transition-colors hover:text-primary"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    item.title
                  )}
                </h2>
                {item.chips}
                {item.rating != null && (
                  <span className="ml-auto shrink-0 font-serif text-sm italic tabular-nums text-primary">
                    {item.rating}
                    <span className="text-[11px] text-muted-foreground not-italic">/10</span>
                  </span>
                )}
              </div>
              {item.tags && <div className="flex flex-wrap gap-1">{item.tags}</div>}
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
