import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { defaultLocale } from "../lib/i18n";

export const metadata: Metadata = {
  title: "i · 个人空间",
  description: "Rust axum + Next.js monorepo",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang={defaultLocale}>
      <body>{children}</body>
    </html>
  );
}
