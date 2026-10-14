/**
 * 全站共享的 motion 入场动画原语。
 * - FadeIn: 单元素淡入上浮（滚动进入视口触发一次）
 * - Stagger / StaggerItem: 网格、列表的交错入场；StaggerItem 可选 hover 悬浮
 * 均通过 useReducedMotion 尊重系统的“减少动态效果”设置。
 *
 * 首屏（SSR + hydration）不播入场动画：motion 会把 initial 写进服务端 HTML，
 * 内容要等 JS 下载执行完才淡入，网络慢时首屏会空白好几秒。之后站内导航挂载的元素照常播放。
 */
import { motion, useReducedMotion, type Variants } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";

let hydrated = false;

/**
 * 首屏渲染（服务端和 hydration 那一次）返回 true，之后挂载的组件返回 false。
 * 用法：`initial={skip ? false : {...}}`。服务端与 hydration 结果一致，不会不匹配。
 */
export function useSkipInitial() {
  const [skip] = useState(() => !hydrated);
  useEffect(() => {
    hydrated = true;
  }, []);
  return skip;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export function FadeIn({
  children,
  className,
  delay = 0,
  y = 14,
}: {
  children?: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
}) {
  const reduce = useReducedMotion();
  const skip = useSkipInitial();
  return (
    <motion.div
      className={className}
      initial={skip ? false : { opacity: 0, y: reduce ? 0 : y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px 0px" }}
      transition={{ duration: 0.5, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
};

export function Stagger({ children, className }: { children?: ReactNode; className?: string }) {
  const skip = useSkipInitial();
  return (
    <motion.div
      className={className}
      variants={container}
      initial={skip ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, margin: "-40px 0px" }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  hover = false,
}: {
  children?: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  const reduce = useReducedMotion();
  const item: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
  };
  return (
    <motion.div
      className={className}
      variants={item}
      whileHover={hover && !reduce ? { y: -4 } : undefined}
      whileTap={hover && !reduce ? { scale: 0.98 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      {children}
    </motion.div>
  );
}

/**
 * 路由切换的页面过渡。调用方用 `key={pathname}` 让它每次换页重新挂载，
 * 所以 useSkipInitial 在每次挂载时重新判断：首屏不动，站内切换才淡入上浮。
 */
export function PageTransition({
  children,
  y = 8,
  duration = 0.3,
}: {
  children?: ReactNode;
  y?: number;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  const skip = useSkipInitial();
  return (
    <motion.div
      initial={skip ? false : { opacity: 0, y: reduce ? 0 : y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
