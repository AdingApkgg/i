import { animate, createScope } from "animejs";
import { useEffect, useRef } from "react";

/** 栏目标题的细剑刻线；SSR 保持完整，减少动态效果时不执行绘制。 */
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
      className="mt-2 h-3.5 w-32 fill-none text-primary"
    >
      <path
        d="M 1 7 H 91 L 97 2 L 103 7 L 97 12 L 91 7 H 127 M 83 3 V 11"
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
