import { useGSAP } from "@gsap/react";
import { siteConfig } from "@i/config";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowDown, ArrowUpRight, CodeXml, Shield, Sword } from "lucide-react";
import { type ReactNode, useRef } from "react";
import { AsunaPortrait } from "./asuna-portrait";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** GSAP 控制首屏包装层与章节线条，不接管 Motion 交互或 Anime.js 的菜单笔画。 */
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
            .from("[data-hero-line]", { y: 18, opacity: 0.65, duration: 0.85, stagger: 0.08 })
            .from("[data-hero-portrait]", { x: 28, opacity: 0.8, duration: 1.3 }, 0)
            .from("[data-hero-actions]", { y: 8, opacity: 0.8, duration: 0.6 }, 0.4);
          gsap.to("[data-hero-ambient]", {
            yPercent: -10,
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
    <div ref={root} id="top" className="sao-home">
      {children}
    </div>
  );
}

export function HomeHero() {
  return (
    <>
      <div className="sao-topline">
        <span>
          <span className="sao-diamond" />
          Asuna 的个人空间<span className="sao-topline-note">／ 日常与冒险的交汇处</span>
        </span>
        <a
          href={siteConfig.socials.github}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
        >
          <CodeXml size={14} />
          <ArrowUpRight size={12} />
        </a>
      </div>
      <section data-home-hero className="sao-hero" aria-label="欢迎来到 Asuna 的世界">
        <div data-hero-ambient aria-hidden="true" className="sao-hero-ambient" />
        <div className="sao-hero-copy">
          <div data-hero-line className="sao-eyebrow">
            <Shield size={14} strokeWidth={1.5} />
            白与绯红，温柔与锋芒
          </div>
          <h1 data-hero-line>
            {siteConfig.title}
            <span aria-hidden="true" className="sao-name-dot">
              .
            </span>
          </h1>
          <div data-hero-line className="sao-hero-kana">
            <span lang="ja">アスナ</span>
            <span>／ {siteConfig.handle}</span>
          </div>
          <p data-hero-line className="sao-hero-lead">
            有想守护的日常，
            <br />
            也有想奔赴的世界。
          </p>
          <p data-hero-line className="sao-hero-note">
            音乐、文字、游戏，和旅途中不舍得删掉的照片。
            <br />
            欢迎来到我的后花园。
          </p>
          <div data-hero-actions className="sao-hero-actions">
            <a href="#world" className="sao-button">
              <Sword size={16} strokeWidth={1.5} />
              探索我的世界
              <ArrowDown size={13} />
            </a>
            <a href="#journal" className="sao-text-link">
              读最近的文字
              <ArrowUpRight size={14} />
            </a>
          </div>
        </div>
        <div data-hero-portrait className="sao-hero-art">
          <AsunaPortrait />
        </div>
        <div className="sao-hero-bottom">
          <span>
            <span className="sao-diamond" />
            在这里，慢慢记录喜欢的生活。
          </span>
          <span className="sao-hero-footnote">灵感来自艾恩葛朗特 · 非官方个人空间</span>
        </div>
      </section>
    </>
  );
}
