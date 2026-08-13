import { Card } from "@i/ui";
import { Image as ImageIcon, Star } from "lucide-react";
import type { ReactNode } from "react";
import { Stagger, StaggerItem } from "@/components/motion";

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
    <Stagger className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {items.map((it) => {
        const inner = (
          <Card className="h-full overflow-hidden transition hover:shadow-md">
            {it.coverUrl ? (
              // biome-ignore lint/performance/noImgElement: 外链封面，沿用原生 img
              <img
                src={it.coverUrl}
                alt={it.title}
                loading="lazy"
                className="aspect-[3/4] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center bg-soft text-primary/40">
                <ImageIcon className="size-8" />
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
                    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-primary">
                      <Star className="size-3 fill-current" /> {it.rating}
                    </span>
                  )}
                </div>
              )}
            </div>
          </Card>
        );
        return (
          <StaggerItem key={it.id} hover>
            {it.link ? (
              <a href={it.link} target="_blank" rel="noopener noreferrer">
                {inner}
              </a>
            ) : (
              inner
            )}
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}
