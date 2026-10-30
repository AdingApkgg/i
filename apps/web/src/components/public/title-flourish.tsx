import { animate, createScope } from "animejs";
import { useEffect, useRef } from "react";

/** 栏目标题的小花枝签名；SSR 输出完整路径，减少动态效果时不执行绘制。 */
export function TitleFlourish() {
  const root = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const scope = createScope({
      root,
      mediaQueries: { reduce: "(prefers-reduced-motion: reduce)" },
    }).add((self) => {
      if (!self || self.matches.reduce) return;
      animate("path", { strokeDashoffset: [1, 0], duration: 850, ease: "inOut(3)" });
    });
    return () => scope.revert();
  }, []);
  return (
    <svg
      ref={root}
      data-title-flourish
      aria-hidden="true"
      viewBox="0 0 128 14"
      className="mt-2 h-3.5 w-32 fill-none text-primary/60"
    >
      <path
        d="M 1 11 Q 38 2 71 9 T 111 5 Q 105 -1 101 5 Q 102 11 111 5 Q 120 -1 124 5 Q 121 11 111 5"
        pathLength="1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="1"
        strokeDashoffset="0"
      />
    </svg>
  );
}
