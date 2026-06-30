"use client";

import dynamic from "next/dynamic";
import { t } from "../../lib/i18n";

/**
 * Live2D 看板娘 slot for the hero. The mascot is loaded with `ssr: false`
 * (it touches browser-only APIs / a custom element). Calling `dynamic` here —
 * inside a client module — is allowed; doing so from a Server Component is not.
 */
const Live2DMascot = dynamic(() => import("@/components/Live2DMascot"), {
  ssr: false,
  loading: () => (
    <div className="h-[380px] w-[280px] animate-pulse rounded-card bg-soft" />
  ),
});

export function MascotSlot() {
  return (
    <div className="relative grid place-items-center overflow-hidden">
      {/* soft moe glow behind the doll */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(220px 260px at 50% 38%, var(--i-bg-2), transparent 70%)",
        }}
      />
      <Live2DMascot width={280} height={380} className="relative z-10" />
      <small className="absolute bottom-3 z-10 text-xs text-muted">
        {t("hero.mascot")}
      </small>
    </div>
  );
}
