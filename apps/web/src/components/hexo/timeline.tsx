import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";

type TimelineItemProps = { label: string; children?: ReactNode };

export function TimelineItem({ label, children }: TimelineItemProps) {
  return (
    <li className="relative pb-6 pl-6 last:pb-0">
      {/* 圆点 */}
      <span className="absolute left-0 top-1.5 size-3 -translate-x-1/2 rounded-full border-2 border-background bg-primary" />
      <div className="font-semibold text-primary">{label}</div>
      {children != null && (
        <div className="mt-1 text-[15px] leading-relaxed text-foreground">
          {children}
        </div>
      )}
    </li>
  );
}

export function Timeline({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const items = Children.toArray(children).filter(
    (child): child is ReactElement<TimelineItemProps> => isValidElement(child),
  );

  return (
    <div className="my-5">
      {title && <h3 className="mb-3 text-lg font-bold">{title}</h3>}
      {/* 左侧竖线 */}
      <ul className="relative ml-1.5 border-l border-border pl-0">
        {items.map((item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 静态时间轴条目
          <TimelineItem key={i} {...item.props} />
        ))}
      </ul>
    </div>
  );
}
