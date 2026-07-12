import type { ReactNode } from "react";
import { SiteHeader } from "@/components/public/site-header";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </>
  );
}
