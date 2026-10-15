import type { ReactNode } from "react";

/**
 * 瀑布流图集:内部是 markdown 渲染出的 <img>,用 CSS 多列布局让图片自然流动。
 */
export function Gallery({ children }: { children: ReactNode }) {
  return (
    <div className="my-5 columns-2 gap-3 md:columns-3 [&_img]:mb-3 [&_img]:w-full [&_img]:rounded-[var(--radius-md)]">
      {children}
    </div>
  );
}
