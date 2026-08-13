"use client";

import { cn } from "@i/ui";
import { AnimatePresence, motion } from "framer-motion";
import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useId,
  useState,
} from "react";

type TabProps = { label: string; children?: ReactNode };

/**
 * <Tab> 只作为数据载体:<Tabs> 直接读取它的 props.label / props.children,
 * 组件本身不参与渲染,故返回 null。
 */
export function Tab(_props: TabProps) {
  return null;
}

export function Tabs({ children }: { children: ReactNode }) {
  const tabs = Children.toArray(children).filter((child): child is ReactElement<TabProps> =>
    isValidElement(child),
  );
  const [active, setActive] = useState(0);
  const uid = useId();

  if (tabs.length === 0) return null;
  const current = Math.min(active, tabs.length - 1);

  return (
    <div className="my-5">
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((tab, i) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: 静态标签列表
            key={i}
            type="button"
            onClick={() => setActive(i)}
            className={cn(
              "relative rounded-pill px-3.5 py-1.5 text-sm font-medium transition",
              i === current ? "text-primary-foreground" : "text-muted-foreground hover:bg-soft",
            )}
          >
            {i === current && (
              <motion.span
                layoutId={`tab-pill-${uid}`}
                className="absolute inset-0 rounded-pill bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            <span className="relative z-10">{tab.props.label}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          className="mt-3 rounded-[var(--radius-md)] bg-card p-4 text-[15px] leading-relaxed"
        >
          {tabs[current]?.props.children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
