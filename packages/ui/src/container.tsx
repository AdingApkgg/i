import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {}

/** Max-width centered page column (matches the mockup `.wrap`, 1080px). */
export function Container({ className = "", ...props }: ContainerProps) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[1080px] px-7", className)}
      {...props}
    />
  );
}
