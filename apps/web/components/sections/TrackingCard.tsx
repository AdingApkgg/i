"use client";

import { Badge, Card } from "@i/ui";
import type { ReactNode } from "react";

export interface TrackingCardProps {
  status: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  coverUrl?: string | null;
  /** Tailwind gradient classes used when there's no cover image. */
  gradient: string;
  href?: string;
}

/** One “最近在……” tile: colorful cover (image or gradient) + overlay status chip. */
export function TrackingCard({
  status,
  title,
  subtitle,
  coverUrl,
  gradient,
  href,
}: TrackingCardProps) {
  const inner = (
    <Card hover className="p-3.5">
      <div
        className={`relative mb-3 h-[120px] overflow-hidden rounded-card-sm bg-gradient-to-br ${gradient}`}
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : null}
        <Badge variant="overlay" className="absolute left-2 top-2">
          {status}
        </Badge>
      </div>
      <div className="truncate text-sm font-semibold text-ink">{title}</div>
      {subtitle != null && (
        <div className="truncate text-xs text-muted">{subtitle}</div>
      )}
    </Card>
  );

  return href ? (
    <a href={href} className="block">
      {inner}
    </a>
  ) : (
    inner
  );
}
