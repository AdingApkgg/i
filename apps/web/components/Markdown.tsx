"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@i/ui";

/**
 * Markdown renderer tuned to the moe pink theme. GFM enabled (tables,
 * strikethrough, task lists, autolinks). Every element maps to the design
 * tokens so it stays readable in both light and dark. Dependency-light:
 * no syntax highlighting — code blocks get a soft rounded surface instead.
 */

type ElProps<T extends keyof React.JSX.IntrinsicElements> =
  ComponentPropsWithoutRef<T> & { node?: unknown; children?: ReactNode };

function isInlineCode(props: ElProps<"code">): boolean {
  // Block code is wrapped in <pre>; react-markdown gives such <code> a
  // language-* className. Anything without one is inline.
  return !/\blanguage-/.test(props.className ?? "");
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-[15px] leading-[1.85] text-ink">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, className, ...p }: ElProps<"h1">) => (
            <h1
              className={cn(
                "mb-4 mt-8 text-2xl font-bold tracking-wide text-ink first:mt-0",
                className,
              )}
              {...p}
            />
          ),
          h2: ({ node, className, ...p }: ElProps<"h2">) => (
            <h2
              className={cn(
                "mb-3 mt-8 flex items-center gap-2 border-b border-line pb-1.5 text-xl font-bold text-ink first:mt-0",
                className,
              )}
              {...p}
            />
          ),
          h3: ({ node, className, ...p }: ElProps<"h3">) => (
            <h3
              className={cn("mb-2 mt-6 text-lg font-semibold text-ink", className)}
              {...p}
            />
          ),
          h4: ({ node, className, ...p }: ElProps<"h4">) => (
            <h4
              className={cn("mb-2 mt-5 text-base font-semibold text-ink", className)}
              {...p}
            />
          ),
          p: ({ node, className, ...p }: ElProps<"p">) => (
            <p className={cn("my-4", className)} {...p} />
          ),
          a: ({ node, className, ...p }: ElProps<"a">) => (
            <a
              className={cn(
                "font-medium text-accent underline decoration-accent/40 underline-offset-2 transition hover:decoration-accent",
                className,
              )}
              target={p.href?.startsWith("http") ? "_blank" : undefined}
              rel={p.href?.startsWith("http") ? "noopener noreferrer" : undefined}
              {...p}
            />
          ),
          ul: ({ node, className, ...p }: ElProps<"ul">) => (
            <ul
              className={cn("my-4 ml-6 list-disc space-y-1.5 marker:text-accent", className)}
              {...p}
            />
          ),
          ol: ({ node, className, ...p }: ElProps<"ol">) => (
            <ol
              className={cn("my-4 ml-6 list-decimal space-y-1.5 marker:text-accent", className)}
              {...p}
            />
          ),
          li: ({ node, className, ...p }: ElProps<"li">) => (
            <li className={cn("leading-relaxed", className)} {...p} />
          ),
          blockquote: ({ node, className, ...p }: ElProps<"blockquote">) => (
            <blockquote
              className={cn(
                "my-5 rounded-card-sm border-l-4 border-accent bg-soft px-4 py-2 text-muted",
                className,
              )}
              {...p}
            />
          ),
          hr: ({ node, className, ...p }: ElProps<"hr">) => (
            <hr className={cn("my-8 border-line", className)} {...p} />
          ),
          img: ({ node, className, ...p }: ElProps<"img">) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className={cn("my-5 rounded-card border border-line shadow-soft-sm", className)}
              alt={p.alt ?? ""}
              {...p}
            />
          ),
          code: ({ node, className, children, ...p }: ElProps<"code">) =>
            isInlineCode({ className, ...p }) ? (
              <code
                className={cn(
                  "rounded-md bg-soft px-1.5 py-0.5 font-mono text-[0.85em] text-accent-ink",
                  className,
                )}
                {...p}
              >
                {children}
              </code>
            ) : (
              <code className={cn("font-mono text-[0.85em]", className)} {...p}>
                {children}
              </code>
            ),
          pre: ({ node, className, ...p }: ElProps<"pre">) => (
            <pre
              className={cn(
                "my-5 overflow-x-auto rounded-card border border-line bg-soft p-4 text-ink shadow-soft-sm",
                className,
              )}
              {...p}
            />
          ),
          table: ({ node, className, ...p }: ElProps<"table">) => (
            <div className="my-5 overflow-x-auto rounded-card border border-line">
              <table className={cn("w-full border-collapse text-sm", className)} {...p} />
            </div>
          ),
          thead: ({ node, className, ...p }: ElProps<"thead">) => (
            <thead className={cn("bg-soft", className)} {...p} />
          ),
          th: ({ node, className, ...p }: ElProps<"th">) => (
            <th
              className={cn(
                "border-b border-line px-3 py-2 text-left font-semibold text-ink",
                className,
              )}
              {...p}
            />
          ),
          td: ({ node, className, ...p }: ElProps<"td">) => (
            <td className={cn("border-b border-line px-3 py-2 text-ink", className)} {...p} />
          ),
          strong: ({ node, className, ...p }: ElProps<"strong">) => (
            <strong className={cn("font-semibold text-ink", className)} {...p} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
