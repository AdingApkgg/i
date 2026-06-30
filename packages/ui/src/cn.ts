/** Tiny className joiner — drops falsy values, trims, single-spaces.
 *  Keeps components dependency-free (no clsx). */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}
