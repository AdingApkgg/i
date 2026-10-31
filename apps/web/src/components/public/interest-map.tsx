import { createScope, createTimeline, type Scope } from "animejs";
import { ArrowUpRight, BookOpen, Camera, Disc3, Gamepad2, Headphones, Orbit } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "react-router";

const places = [
  { key: "blog", label: "博客", note: "把想法留成文字", icon: BookOpen },
  { key: "music", label: "音乐", note: "给生活配一段旋律", icon: Headphones },
  { key: "maimai", label: "舞萌", note: "指尖与节奏的相遇", icon: Disc3 },
  { key: "vn", label: "视觉小说", note: "走进另一个故事", icon: Gamepad2 },
  { key: "touhou", label: "东方", note: "幻想乡里的片刻", icon: Orbit },
  { key: "gallery", label: "相册", note: "把平凡的瞬间珍藏", icon: Camera },
] as const;

/** Anime.js 绘制切角菜单边框与图标，六条时间线可重播，不累积交互实例。 */
export function InterestMap() {
  const root = useRef<HTMLElement>(null);
  const scope = useRef<Scope | null>(null);
  useEffect(() => {
    const scene = createScope({
      root,
      mediaQueries: { reduce: "(prefers-reduced-motion: reduce)" },
    }).add((self) => {
      if (!self || self.matches.reduce) return;
      const entries = new Map(
        places.map((place, i) => [
          place.key,
          createTimeline({ delay: i * 45, defaults: { ease: "out(3)" } })
            .add(
              `[data-garden-branch="${place.key}"]`,
              { strokeDashoffset: [1, 0], duration: 850 },
              0,
            )
            .add(
              `[data-garden-bloom="${place.key}"]`,
              { scale: [0.88, 1.08, 1], duration: 600 },
              100,
            ),
        ]),
      );
      self.add("bloom", (key: (typeof places)[number]["key"]) => {
        if (!self.matches.reduce) entries.get(key)?.restart();
      });
    });
    scope.current = scene;
    return () => {
      scope.current = null;
      scene.revert();
    };
  }, []);

  return (
    <nav ref={root} aria-label="兴趣地图" className="sao-world-menu">
      {places.map(({ key, label, note, icon: Icon }) => (
        <Link
          key={key}
          to={`/${key}`}
          prefetch="intent"
          aria-label={`前往${label}`}
          className="sao-world-entry"
          onPointerEnter={() => scope.current?.methods.bloom?.(key)}
          onFocus={() => scope.current?.methods.bloom?.(key)}
        >
          <svg aria-hidden="true" viewBox="0 0 300 90" preserveAspectRatio="none" fill="none">
            <path
              data-garden-branch={key}
              d="M1 89V1H287L299 13V89Z"
              pathLength="1"
              stroke="currentColor"
              strokeWidth="0.7"
              vectorEffect="non-scaling-stroke"
              strokeDasharray="1"
              strokeDashoffset="0"
            />
          </svg>
          <span data-garden-bloom={key} className="sao-world-icon">
            <Icon size={24} strokeWidth={1.3} />
          </span>
          <span>
            <strong>{label}</strong>
            <small>{note}</small>
          </span>
          <span className="sao-world-arrow">
            <ArrowUpRight size={13} strokeWidth={1.4} />
          </span>
        </Link>
      ))}
    </nav>
  );
}
