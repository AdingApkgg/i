"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type * as React from "react";
import { useState } from "react";

const COLOR_MAP: Record<string, string> = {
  blue: "#3b82f6",
  cyan: "#06b6d4",
  green: "#22c55e",
  yellow: "#eab308",
  orange: "#f97316",
  red: "#ef4444",
  pink: "var(--primary)",
};

/**
 * 折叠块（受控 + framer-motion 高度过渡）。
 * MDX 预处理器会输出 <HideToggle title color>...</HideToggle>。
 */
export function HideToggle({
  title,
  color,
  children,
}: {
  title?: string;
  color?: string;
  children?: React.ReactNode;
}) {
  const accent = (color && COLOR_MAP[color]) || undefined;
  const [open, setOpen] = useState(false);

  return (
    <div className="my-4 overflow-hidden rounded-[var(--radius-md)] border border-border bg-card">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left font-medium text-foreground select-none"
        style={accent ? { color: accent } : undefined}
      >
        <motion.span
          aria-hidden
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="inline-flex text-muted-foreground"
        >
          <ChevronRight className="size-4" />
        </motion.span>
        <span>{title ?? "展开"}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <div className="border-t border-border px-4 py-3 text-foreground [&>:first-child]:mt-0 [&>:last-child]:mb-0">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
