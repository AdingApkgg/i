import { siteConfig } from "@i/config";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/components/providers";
import { RSS_ALTERNATE_TYPES, siteUrl } from "@/lib/site-url";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${siteConfig.title} · 个人空间`, template: `%s · ${siteConfig.title}` },
  description: siteConfig.description,
  metadataBase: new URL(siteUrl()),
  alternates: { types: RSS_ALTERNATE_TYPES },
  openGraph: {
    siteName: siteConfig.title,
    locale: "zh_CN",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
