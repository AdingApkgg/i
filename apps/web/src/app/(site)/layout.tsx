import type { ReactNode } from "react";
import { PlayerProvider } from "@/components/player/player-context";
import { MascotWidget } from "@/components/public/mascot-widget";
import { SiteHeader } from "@/components/public/site-header";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <PlayerProvider>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      <MascotWidget />
    </PlayerProvider>
  );
}
