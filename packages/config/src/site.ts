/** Global site metadata — used by layout, nav, footer, SEO. */
export const siteConfig = {
  name: "i",
  title: "Asuna",
  handle: "@AdingApkgg",
  description: "独属于某个变态的后花园 · 用 Hono 和 React Router 慢慢长大的地方",
  tagline: "独属于某个变态的后花园 · 用 Hono 和 React Router 慢慢长大的地方",
  // Default origin; the app overrides with NEXT_PUBLIC_SITE_URL where needed.
  url: "http://localhost:3000",
  locale: "zh-CN",
  socials: {
    github: "https://github.com/AdingApkgg",
    bilibili: "https://space.bilibili.com/1198037522",
    telegram: "https://t.me/AsunaNarusaka",
    email: "mailto:i@saop.cc",
    rss: "/rss.xml",
  },
} as const;

export type SiteConfig = typeof siteConfig;
