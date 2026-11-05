/**
 * 收藏条目的二级详情页骨架（视觉小说 / 东方，后续域可继续复用）。
 * 结构：返回链接 → 封面 + 标题 / 徽记 / 评分 / 字段清单 → 长文本区 → 备注 → 外链 → 相关条目。
 *
 * 窄屏封面压到 96px 与正文横向并排，首屏就能读到简介，不会先被一张大图顶下去；
 * 所有长文本走 wrap-anywhere，长 URL 与无空格的中文串都不会把窄屏撑出横向滚动。
 */
import { ArrowLeft, ExternalLink, Star } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { thumbProps } from "@/lib/thumb";
import { Badge } from "./collection";

export interface DetailFact {
  label: string;
  value: ReactNode;
}

export interface DetailSection {
  label: string;
  body: string;
}

export interface DetailLink {
  label: string;
  href: string;
}

export interface DetailRelated {
  title: string;
  to: string;
  meta?: string;
}

export function RecordDetail({
  backTo,
  backLabel,
  title,
  kicker,
  coverUrl,
  coverFit = "portrait",
  chips,
  rating,
  facts = [],
  tags = [],
  sections = [],
  note,
  links = [],
  related = [],
  children,
}: {
  backTo: string;
  backLabel: string;
  title: string;
  /** 标题上方的小字：厂牌 / 作品编号等 */
  kicker?: string | null;
  coverUrl?: string | null;
  /** portrait：统一裁成 3:4；natural：保持官方原图比例，一像素都不裁 */
  coverFit?: "portrait" | "natural";
  chips?: ReactNode;
  rating?: number | null;
  facts?: DetailFact[];
  tags?: readonly string[];
  sections?: DetailSection[];
  note?: string | null;
  links?: DetailLink[];
  related?: DetailRelated[];
  children?: ReactNode;
}) {
  return (
    <article className="min-w-0">
      <Link
        to={backTo}
        prefetch="intent"
        className="group mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground transition hover:text-primary"
      >
        <ArrowLeft className="size-3 transition-transform group-hover:-translate-x-0.5" />
        {backLabel}
      </Link>

      <div className="flex flex-col gap-5 sm:flex-row sm:gap-6">
        {coverUrl && (
          <div className="w-24 shrink-0 sm:w-44">
            <img
              {...thumbProps(coverUrl, [320, 640, 960], "(min-width: 640px) 176px, 96px")}
              alt={`${title} 封面`}
              className={
                coverFit === "portrait"
                  ? "aspect-[3/4] w-full rounded-lg bg-soft object-cover ring-1 ring-border/60"
                  : "block h-auto w-full rounded-lg bg-soft ring-1 ring-border/60"
              }
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {kicker && (
            <p className="text-[11px] tracking-[0.18em] wrap-anywhere text-muted-foreground uppercase">
              {kicker}
            </p>
          )}
          <h1 className="mt-1 text-2xl leading-tight font-bold wrap-anywhere">{title}</h1>
          {(chips || rating != null) && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {chips}
              {rating != null && (
                <span className="inline-flex items-center gap-0.5 font-serif text-sm italic text-primary tabular-nums">
                  <Star className="size-3 fill-current" aria-hidden="true" />
                  {rating}
                  <span className="text-[11px] text-muted-foreground not-italic">/10</span>
                </span>
              )}
            </div>
          )}
          {tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <Badge key={tag}>{tag}</Badge>
              ))}
            </div>
          )}
          {facts.length > 0 && (
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-border/60 pt-3 text-sm sm:grid-cols-3">
              {facts.map((fact) => (
                <div key={fact.label} className="min-w-0">
                  <dt className="text-[11px] tracking-wide text-muted-foreground">{fact.label}</dt>
                  <dd className="mt-0.5 wrap-anywhere tabular-nums">{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      {sections.map((section, index) => (
        <section key={section.label} className={index === 0 ? "mt-7" : "mt-6"}>
          <h2 className="mb-2 flex items-center gap-2 text-xs tracking-[0.18em] text-primary/70 uppercase">
            {section.label}
            <span className="h-px flex-1 bg-border/70" aria-hidden="true" />
          </h2>
          <p className="text-[15px] leading-relaxed wrap-anywhere whitespace-pre-wrap text-foreground/90">
            {section.body}
          </p>
        </section>
      ))}

      {note && (
        <p className="mt-6 border-l-2 border-primary/40 pl-3 text-sm leading-relaxed wrap-anywhere whitespace-pre-wrap text-muted-foreground">
          {note}
        </p>
      )}

      {links.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              {link.label}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          ))}
        </div>
      )}

      {children}

      {related.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-xs tracking-[0.18em] text-muted-foreground uppercase">
            相关条目
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {related.map((item) => (
              <li key={item.to} className="min-w-0">
                <Link
                  to={item.to}
                  prefetch="intent"
                  className="group flex items-baseline gap-2 rounded-lg border border-border/70 bg-card/40 px-3 py-2 transition-colors hover:border-primary/35 hover:bg-soft/50"
                >
                  <span className="min-w-0 flex-1 text-sm wrap-anywhere group-hover:text-primary">
                    {item.title}
                  </span>
                  {item.meta && (
                    <span className="shrink-0 font-serif text-[11px] italic text-muted-foreground tabular-nums">
                      {item.meta}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
