import { Card } from "@i/ui";
import type { ReactNode } from "react";

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-pill bg-soft px-2 py-0.5 text-[11px] font-medium text-primary">
      {children}
    </span>
  );
}

export function EmptyCard({ children }: { children: ReactNode }) {
  return (
    <Card>
      <div className="p-8 text-center text-sm text-muted-foreground">{children}</div>
    </Card>
  );
}

export interface CollectionItem {
  id: string;
  title: string;
  subtitle?: string | null;
  status?: string | null;
  coverUrl?: string | null;
  rating?: number | null;
  link?: string | null;
}

/** Poster-grid for "collection" domains (music/movie/vn/touhou/device/maimai). */
export function Collection({ items, empty }: { items: CollectionItem[]; empty?: string }) {
  if (items.length === 0) return <EmptyCard>{empty ?? "还没有内容,先去 /dash 添加吧 ✿"}</EmptyCard>;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {items.map((it) => {
        const inner = (
          <Card className="h-full overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
            {it.coverUrl ? (
              // biome-ignore lint/a11y/useAltText: alt provided via title
              <img
                src={it.coverUrl}
                alt={it.title}
                loading="lazy"
                className="aspect-[3/4] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center bg-soft text-2xl text-primary/40">
                ✿
              </div>
            )}
            <div className="p-3">
              <div className="truncate text-sm font-semibold">{it.title}</div>
              {it.subtitle && (
                <div className="truncate text-xs text-muted-foreground">{it.subtitle}</div>
              )}
              {(it.status || it.rating != null) && (
                <div className="mt-1.5 flex items-center gap-2">
                  {it.status && <Badge>{it.status}</Badge>}
                  {it.rating != null && (
                    <span className="text-xs font-medium text-primary">★ {it.rating}</span>
                  )}
                </div>
              )}
            </div>
          </Card>
        );
        return it.link ? (
          <a key={it.id} href={it.link} target="_blank" rel="noopener noreferrer">
            {inner}
          </a>
        ) : (
          <div key={it.id}>{inner}</div>
        );
      })}
    </div>
  );
}
