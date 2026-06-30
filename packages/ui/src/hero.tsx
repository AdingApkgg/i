import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export interface HeroProps extends HTMLAttributes<HTMLElement> {}

/** Hero shell — responsive grid (1.4fr / 1fr on md+), gap matches mockup.
 *  Compose two <Card> children inside (profile + Live2D slot). */
export function Hero({ className = "", children, ...props }: HeroProps) {
  return (
    <section
      className={cn(
        "grid grid-cols-1 gap-[22px] md:grid-cols-[1.4fr_1fr]",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}
