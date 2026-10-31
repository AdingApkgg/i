import { createScope, createTimeline, type Scope } from "animejs";
import { BookOpen, Camera, Disc3, Flower2, Gamepad2, Headphones } from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "react-router";

const places = [
  { key: "blog", label: "博客", x: 24, y: 20, icon: BookOpen },
  { key: "music", label: "音乐", x: 74, y: 16, icon: Headphones },
  { key: "maimai", label: "舞萌", x: 87, y: 51, icon: Disc3 },
  { key: "vn", label: "视觉小说", x: 72, y: 83, icon: Gamepad2 },
  { key: "touhou", label: "东方", x: 25, y: 84, icon: Flower2 },
  { key: "gallery", label: "相册", x: 12, y: 51, icon: Camera },
] as const;

/** Anime.js 只负责 SVG 枝条和节点内层；外层入场由 HomeScene 的 GSAP 编排。 */
export function InterestMap() {
  const root = useRef<HTMLElement>(null);
  const scope = useRef<Scope | null>(null);

  useEffect(() => {
    const scene = createScope({
      root,
      mediaQueries: { reduce: "(prefers-reduced-motion: reduce)" },
    }).add((self) => {
      if (!self || self.matches.reduce) return;
      // 每个节点只持有一条时间线，重复悬停/聚焦时重播，不累积动画实例。
      const blooms = new Map(
        places.map((place, i) => [
          place.key,
          createTimeline({
            delay: i * 55,
            defaults: { ease: "out(3)" },
          })
            .add(
              `[data-garden-branch="${place.key}"]`,
              {
                strokeDashoffset: [1, 0],
                duration: 850,
              },
              0,
            )
            .add(
              `[data-garden-bloom="${place.key}"]`,
              {
                scale: [0.88, 1.08, 1],
                duration: 650,
              },
              100,
            ),
        ]),
      );
      self.add("bloom", (key: (typeof places)[number]["key"]) => {
        if (!self.matches.reduce) blooms.get(key)?.restart();
      });
    });
    scope.current = scene;
    return () => {
      scope.current = null;
      scene.revert();
    };
  }, []);

  return (
    <nav
      ref={root}
      aria-label="兴趣地图"
      className="interest-map relative mx-auto aspect-[9/8] w-full max-w-96"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 360 320"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible fill-none text-primary"
      >
        <circle
          cx="180"
          cy="160"
          r="108"
          stroke="currentColor"
          strokeOpacity="0.12"
          strokeDasharray="2 9"
        />
        <circle cx="180" cy="160" r="62" stroke="currentColor" strokeOpacity="0.12" />
        {places.map((place) => {
          const x = place.x * 3.6;
          const y = place.y * 3.2;
          return (
            <path
              key={place.key}
              data-garden-branch={place.key}
              d={`M 180 160 Q ${180 + (x - 180) * 0.1} ${y} ${x} ${y}`}
              pathLength="1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeOpacity="0.55"
              strokeDasharray="1"
              strokeDashoffset="0"
            />
          );
        })}
      </svg>
      <div className="pointer-events-none absolute left-1/2 top-1/2 grid size-20 -translate-x-1/2 -translate-y-1/2 place-content-center rounded-full border border-primary/20 bg-card text-center">
        <Flower2 className="mx-auto size-6 text-primary" strokeWidth={1.25} />
        <span className="mt-1 text-xs text-muted-foreground">后花园</span>
      </div>
      {places.map(({ key, label, x, y, icon: Icon }) => (
        <Link
          key={key}
          to={`/${key}`}
          prefetch="intent"
          aria-label={`前往${label}`}
          style={{ left: `${x}%`, top: `${y}%` }}
          className="garden-link absolute -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
          onPointerEnter={() => scope.current?.methods.bloom?.(key)}
          onFocus={() => scope.current?.methods.bloom?.(key)}
        >
          <span
            data-garden-bloom={key}
            className="flex size-16 flex-col items-center justify-center gap-1 rounded-full border border-primary/20 bg-card text-primary transition-colors hover:bg-accent"
          >
            <Icon className="size-5" strokeWidth={1.5} />
            <span className="text-xs font-medium">{label}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}
