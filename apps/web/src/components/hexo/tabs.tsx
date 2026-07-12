"use client";

import { cn } from "@i/ui";
import {
  Children,
  isValidElement,
  useState,
  type ReactElement,
  type ReactNode,
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
  const tabs = Children.toArray(children).filter(
    (child): child is ReactElement<TabProps> => isValidElement(child),
  );
  const [active, setActive] = useState(0);

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
              "rounded-pill px-3.5 py-1.5 text-sm font-medium transition",
              i === current
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-soft",
            )}
          >
            {tab.props.label}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-[var(--radius-md)] bg-card p-4 text-[15px] leading-relaxed">
        {tabs[current]?.props.children}
      </div>
    </div>
  );
}
