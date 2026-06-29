import type { ButtonHTMLAttributes } from "react";

/** Minimal shared button — the seed of the design system (`packages/ui`). */
export function Button({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center rounded-md bg-pink-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-pink-500 disabled:opacity-50 ${className}`}
      {...props}
    />
  );
}
