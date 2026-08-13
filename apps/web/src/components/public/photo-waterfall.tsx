"use client";

/**
 * 瀑布流相册（参考 2x.nz/ai 精选 Tab 的 waterfall 布局）：
 * - 绝对定位 + 最短列贪心放置，图片按真实宽高比排布、不限高度
 * - 图片加载前用等宽正方形占位，onLoad 后按 naturalWidth/Height 回填真实高度
 * - 底部哨兵 IntersectionObserver 触发游标分页无限加载
 * - 容器宽度测量完成前（SSR / 未水合）退化为 CSS columns，首屏即可见且图片提前开始加载
 * - 服务端预取失败时 initial 传 null，由客户端查询接管（可重试，而非误报空相册）
 */
import { useInfiniteQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyCard } from "@/components/public/collection";
import { PhotoLightbox } from "@/components/public/photo-lightbox";
import { useTRPC } from "@/lib/trpc/client";
import type { AppRouter } from "@/server/root";

export type GalleryPage = inferRouterOutputs<AppRouter>["gallery"]["page"];
type Photo = GalleryPage["items"][number];

/** 列间距（px），与 fallback 的 gap-3 一致 */
const GAP = 12;

/** 按容器宽度取列数（内容区 max-w-5xl ≈ 992px，对应参考站窗口断点） */
function columnsFor(w: number) {
  if (w >= 900) return 5;
  if (w >= 700) return 4;
  if (w >= 440) return 3;
  return 2;
}

/** 比例缓存按展示用的 src 键控：换图（同 id 不同 URL）后旧比例自动失效 */
function srcOf(it: Photo) {
  return it.thumbUrl || it.imageUrl;
}

export function PhotoWaterfall({
  initial,
  pageSize,
  albumId,
  emptyText,
}: {
  initial: GalleryPage | null;
  pageSize: number;
  /** 字符串 = 该图集；null = 未分类；不传 = 全部 */
  albumId?: string | null;
  emptyText?: string;
}) {
  const trpc = useTRPC();
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage, isPending, isError } =
    useInfiniteQuery(
      trpc.gallery.page.infiniteQueryOptions(
        { limit: pageSize, albumId },
        {
          getNextPageParam: (last) => last.nextCursor,
          initialCursor: null,
          // 照片不常变，5 分钟内窗口聚焦不重刷所有已加载页（避免滚动中布局跳动）
          staleTime: 300_000,
          ...(initial ? { initialData: { pages: [initial], pageParams: [null] } } : {}),
        },
      ),
    );

  // 追加分页时按 id 去重，防御新增/删除导致的页间重叠
  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: Photo[] = [];
    for (const page of data?.pages ?? [])
      for (const it of page.items)
        if (!seen.has(it.id)) {
          seen.add(it.id);
          out.push(it);
        }
    return out;
  }, [data]);

  // 容器宽度：ResizeObserver 跟踪，宽度未知时走 CSS columns fallback
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 灯箱：当前打开的照片下标，null = 关闭
  const [lightbox, setLightbox] = useState<number | null>(null);

  // 每张图的高宽比（naturalHeight / naturalWidth）
  const [ratios, setRatios] = useState<Record<string, number>>({});
  const record = useCallback((key: string, ratio: number) => {
    if (!ratio || !Number.isFinite(ratio)) return;
    setRatios((cur) => (cur[key] ? cur : { ...cur, [key]: ratio }));
  }, []);
  // complete 含加载失败（naturalWidth 0）：记 1:1 兜底，方块不再无限闪烁
  const recordFrom = useCallback(
    (key: string, img: HTMLImageElement) => {
      record(key, img.naturalWidth ? img.naturalHeight / img.naturalWidth : 1);
    },
    [record],
  );

  // 最短列贪心布局：cells 与 items 一一对应
  const layout = useMemo(() => {
    if (!width || items.length === 0) return null;
    const cols = columnsFor(width);
    const colW = (width - (cols - 1) * GAP) / cols;
    const tops = new Array<number>(cols).fill(0);
    const cells = items.map((it) => {
      let col = 0;
      for (let c = 1; c < cols; c++) if ((tops[c] ?? 0) < (tops[col] ?? 0)) col = c;
      const top = tops[col] ?? 0;
      const ratio = ratios[srcOf(it)];
      const height = ratio ? colW * ratio : colW;
      tops[col] = top + height + GAP;
      return {
        top,
        left: col * (colW + GAP),
        width: colW,
        height,
        loaded: Boolean(ratio),
      };
    });
    return { cells, height: Math.max(...tops) - GAP };
  }, [width, items, ratios]);

  // 底部哨兵：提前 800px 预取下一页。
  // IntersectionObserver 只在交叉状态“变化”时回调：哨兵若一直停留在视口附近，
  // 追加一页后不会再次触发。依赖 items.length / isFetchingNextPage 在每次
  // 追加完成后重建 observer——新 observer 会立即上报当前交叉状态，接力下一页。
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const fetchingRef = useRef(false);
  fetchingRef.current = isFetchingNextPage;
  // biome-ignore lint/correctness/useExhaustiveDependencies(items.length): 追加后重建 observer 是接力加载的关键
  // biome-ignore lint/correctness/useExhaustiveDependencies(isFetchingNextPage): 拉取失败后也要重试
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !fetchingRef.current) void fetchNextPage();
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, fetchNextPage, items.length, isFetchingNextPage]);

  if (isPending) return <p className="py-10 text-center text-sm text-muted-foreground">加载中…</p>;
  if (isError && items.length === 0)
    return <EmptyCard>照片加载失败了，稍后刷新再试试 ᐕ)⁾⁾</EmptyCard>;
  if (items.length === 0)
    return <EmptyCard>{emptyText ?? "还没有照片,先去 /dash 添加吧 ✿"}</EmptyCard>;

  return (
    <>
      <div
        ref={containerRef}
        className={layout ? "relative" : "columns-2 gap-3 sm:columns-3 md:columns-4 lg:columns-5"}
        style={layout ? { height: layout.height } : undefined}
      >
        {items.map((it, i) => {
          const cell = layout?.cells[i];
          return (
            <figure
              key={it.id}
              className={`group m-0 overflow-hidden rounded-[var(--radius-lg)] bg-soft ${
                cell
                  ? `absolute motion-safe:transition-[top,left,width,height] ${cell.loaded ? "" : "animate-pulse"}`
                  : "relative mb-3 break-inside-avoid"
              }`}
              style={
                cell
                  ? { top: cell.top, left: cell.left, width: cell.width, height: cell.height }
                  : undefined
              }
            >
              <button
                type="button"
                aria-label={`查看${it.title || "照片"}`}
                className="block w-full cursor-zoom-in"
                onClick={() => setLightbox(i)}
              >
                {/* biome-ignore lint/performance/noImgElement: MinIO 图源，沿用原生 img */}
                <img
                  src={srcOf(it)}
                  alt={it.title || "照片"}
                  title={it.title || undefined}
                  loading="lazy"
                  ref={(img) => {
                    if (img?.complete) recordFrom(srcOf(it), img);
                  }}
                  onLoad={(e) => recordFrom(srcOf(it), e.currentTarget)}
                  onError={(e) => recordFrom(srcOf(it), e.currentTarget)}
                  className={`block w-full transition group-hover:scale-105 ${
                    cell && !cell.loaded ? "opacity-0" : "opacity-100"
                  }`}
                />
              </button>
              {it.title && (
                <figcaption className="absolute inset-x-0 bottom-0 translate-y-full bg-gradient-to-t from-black/60 to-transparent p-2 text-xs font-medium text-white transition group-hover:translate-y-0">
                  <span className="line-clamp-1">{it.title}</span>
                </figcaption>
              )}
            </figure>
          );
        })}
      </div>
      <div ref={sentinelRef} className="h-px" />
      {isFetchingNextPage ? (
        <p className="py-6 text-center text-xs text-muted-foreground">加载中…</p>
      ) : hasNextPage ? null : (
        <p className="py-6 text-center text-xs text-muted-foreground">已经到底啦 ✿</p>
      )}
      <PhotoLightbox
        items={items}
        index={lightbox}
        onIndexChange={setLightbox}
        onClose={() => setLightbox(null)}
        hasMore={hasNextPage}
        onLoadMore={() => {
          if (!fetchingRef.current) void fetchNextPage();
        }}
      />
    </>
  );
}
