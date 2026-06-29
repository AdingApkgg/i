import zh from "../messages/zh.json";

/**
 * i18n-ready, single-locale (zh) for now. Strings live in `messages/<locale>.json`
 * and call sites use `t("a.b")` — adding `en`/`ja` later (or swapping in
 * next-intl) is mechanical and doesn't touch call sites.
 */
export const defaultLocale = "zh";
export const locales = ["zh"] as const;
export type Locale = (typeof locales)[number];

const dictionaries: Record<Locale, unknown> = { zh };

export function t(key: string, locale: Locale = defaultLocale): string {
  const value = key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object" && part in node) {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, dictionaries[locale] ?? zh);
  return typeof value === "string" ? value : key;
}
