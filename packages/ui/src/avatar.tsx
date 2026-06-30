import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

export type AvatarSize = "sm" | "md" | "lg";

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  size?: AvatarSize;
  /** Fallback content (emoji / initials) shown when no `src`. */
  children?: ReactNode;
}

const SIZES: Record<AvatarSize, string> = {
  sm: "h-[30px] w-[30px] text-base border-2",
  md: "h-12 w-12 text-xl border-[3px]",
  lg: "h-[84px] w-[84px] text-[34px] border-4",
};

/** Round gradient avatar with white ring + soft shadow. */
export function Avatar({
  className = "",
  src,
  alt = "",
  size = "md",
  children,
  ...props
}: AvatarProps) {
  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded-full border-white shadow-soft-md",
        SIZES[size],
        className,
      )}
      style={
        src ? undefined : { backgroundImage: "var(--i-grad-avatar)" }
      }
      {...props}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} className="h-full w-full object-cover" />
      ) : (
        children
      )}
    </div>
  );
}
