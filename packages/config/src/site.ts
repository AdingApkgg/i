/** Global site metadata — used by layout, nav, footer, SEO. */
export const siteConfig = {
  name: "i",
  title: "Asuna",
  handle: "@AdingApkgg",
  description: "独属于某个变态的后花园 · 用 Next 和 Prisma 慢慢长大的地方",
  tagline: "独属于某个变态的后花园 · 用 Next 和 Prisma 慢慢长大的地方",
  // Default origin; the app overrides with NEXT_PUBLIC_SITE_URL where needed.
  url: "http://localhost:3000",
  locale: "zh-CN",
  socials: {
    github: "https://github.com/AdingApkgg",
    email: "mailto:xuyuning0430@gmail.com",
    rss: "/rss.xml",
  },
} as const;

export type SiteConfig = typeof siteConfig;
