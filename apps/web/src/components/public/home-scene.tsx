import { useGSAP } from "@gsap/react";
import { NAV_DOMAINS, siteConfig } from "@i/config";
import { Card, CardBody } from "@i/ui";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { type ReactNode, useRef } from "react";
import { Link } from "react-router";
import { InterestMap } from "./interest-map";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** 首页的演出层：GSAP 只编排 hero 外层、背景和章节线条，不接管 Motion 卡片。 */
export function HomeScene({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const media = gsap.matchMedia();
      media.add(
        "(prefers-reduced-motion: no-preference)",
        () => {
          gsap
            .timeline({ defaults: { ease: "power3.out" } })
            .from("[data-hero-line]", { y: 24, opacity: 0.65, duration: 0.8, stagger: 0.09 })
            .from("[data-hero-map]", { rotate: -7, scale: 0.92, duration: 1.1 }, 0.1)
            .from(
              "[data-hero-shortcut]",
              { y: 10, opacity: 0.6, duration: 0.45, stagger: 0.025 },
              0.35,
            );
          gsap.to("[data-hero-ambient]", {
            yPercent: -22,
            ease: "none",
            scrollTrigger: {
              trigger: "[data-home-hero]",
              start: "top top",
              end: "bottom top",
              scrub: 0.6,
            },
          });
          for (const section of gsap.utils.toArray<HTMLElement>(
            "[data-home-section]",
            root.current,
          )) {
            gsap.fromTo(
              section.querySelector("[data-section-rule]"),
              { scaleX: 0 },
              {
                scaleX: 1,
                ease: "none",
                scrollTrigger: { trigger: section, start: "top 95%", end: "top 65%", scrub: 0.3 },
              },
            );
          }
        },
        root,
      );
      return () => media.revert();
    },
    { scope: root },
  );

  return (
    <div ref={root} className="space-y-8">
      {children}
    </div>
  );
}

export function HomeHero() {
  return (
    <Card data-home-hero className="relative isolate overflow-hidden">
      <div
        data-hero-ambient
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-24 -z-10 size-96 rounded-full border-[40px] border-primary/[0.035]"
      />
      <CardBody className="grid items-center gap-3 p-6 sm:p-8 md:grid-cols-[1.1fr_1fr]">
        <div className="min-w-0">
          <span
            data-hero-line
            className="inline-flex items-center gap-1.5 rounded-pill bg-soft px-3 py-1 text-sm font-medium text-primary"
          >
            <span className="size-1.5 rounded-full bg-primary" />
            在线
          </span>
          <h1 data-hero-line className="mt-4 text-4xl font-bold tracking-wide sm:text-5xl">
            {siteConfig.title}
          </h1>
          <div data-hero-line className="mt-2 text-sm font-semibold text-primary">
            {siteConfig.handle}
          </div>
          <p
            data-hero-line
            className="mt-4 max-w-sm text-[15px] leading-relaxed text-muted-foreground"
          >
            {siteConfig.tagline}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {NAV_DOMAINS.map((domain) => (
              <Link
                data-hero-shortcut
                prefetch="intent"
                key={domain.key}
                to={domain.path}
                className="rounded-pill bg-soft px-3 py-1.5 text-[13px] font-medium text-accent-foreground transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
              >
                {domain.label}
              </Link>
            ))}
          </div>
        </div>
        <div data-hero-map className="min-w-0 py-2">
          <InterestMap />
        </div>
      </CardBody>
    </Card>
  );
}
