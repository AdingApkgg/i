"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@i/ui";

/**
 * Themed Markdown renderer for the editor's live preview. Styling is scoped
 * via explicit component overrides so it matches the moe token palette in both
 * light and dark, without depending on a Tailwind typography plugin.
 */
export function Markdown({
  children,
  className = "",
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={cn("text-[15px] leading-relaxed text-ink", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (p) => (
            <h1 className="mt-6 mb-3 text-2xl font-bold text-ink first:mt-0" {...p} />
          ),
          h2: (p) => (
            <h2 className="mt-6 mb-3 text-xl font-bold text-ink first:mt-0" {...p} />
          ),
          h3: (p) => (
            <h3 className="mt-5 mb-2 text-lg font-bold text-ink first:mt-0" {...p} />
          ),
          p: (p) => <p className="my-3 text-ink" {...p} />,
          a: (p) => (
            <a className="text-accent underline underline-offset-2 hover:opacity-80" {...p} />
          ),
          ul: (p) => <ul className="my-3 list-disc pl-6 marker:text-accent" {...p} />,
          ol: (p) => <ol className="my-3 list-decimal pl-6 marker:text-accent" {...p} />,
          li: (p) => <li className="my-1" {...p} />,
          blockquote: (p) => (
            <blockquote
              className="my-4 border-l-4 border-accent/50 bg-soft/40 py-1 pl-4 italic text-muted"
              {...p}
            />
          ),
          hr: () => <hr className="my-6 border-line" />,
          table: (p) => (
            <div className="my-4 overflow-x-auto">
              <table
                className="w-full border-collapse text-sm [&_td]:border [&_td]:border-line [&_td]:px-3 [&_td]:py-1.5 [&_th]:border [&_th]:border-line [&_th]:bg-soft/40 [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left"
                {...p}
              />
            </div>
          ),
          code: ({ className: c, children, ...rest }) => {
            const isBlock = /language-/.test(c ?? "");
            if (isBlock) {
              return (
                <code className={cn("font-mono text-[13px]", c)} {...rest}>
                  {children}
                </code>
              );
            }
            return (
              <code
                className="rounded bg-soft px-1.5 py-0.5 font-mono text-[13px] text-accent-ink"
                {...rest}
              >
                {children}
              </code>
            );
          },
          pre: (p) => (
            <pre
              className="my-4 overflow-x-auto rounded-card border border-line bg-soft/30 p-4 text-[13px]"
              {...p}
            />
          ),
          img: (p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="my-4 max-w-full rounded-card border border-line" alt="" {...p} />
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
