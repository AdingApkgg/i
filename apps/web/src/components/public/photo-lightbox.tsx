"use client";

/**
 * 相册灯箱（交互规格参考 2x.nz/ai 的 image-lightbox）：
 * - 滚轮以光标为锚缩放（1–6 倍）、点图 1↔2.5 倍、缩放后拖拽平移（带边界）
 * - 双指捏合缩放（中点锚定 + 跟随中点平移；Pointer Events 桌面/移动通用）
 * - 1 倍时横向滑动切换；←/→ 键切换、Esc/点空白关闭；到已加载末尾自动拉下一页并前进
 * - 打开时锁定页面滚动、焦点移入弹层（关闭后归还）；切图/重开重置变换并预加载相邻原图
 *
 * 实现注意：
 * - 缩放平移合并为单一 view 状态 + 纯函数式更新（StrictMode 会双调用 updater，
 *   分离的 setState 嵌套会把锚点数学应用两次导致漂移）
 * - 变换作用在包装层，motion 组件会接管自身 transform
 */
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Download, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface LightboxPhoto {
  id: string;
  title: string;
  imageUrl: string;
  thumbUrl: string | null;
  description: string | null;
}

interface View {
  scale: number;
  x: number;
  y: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const CLICK_SCALE = 2.5;
const SWIPE_PX = 70;
/** 平移边界：至少留出这么多像素的图片在舞台内 */
const PAN_MARGIN = 80;
const RESET_VIEW: View = { scale: 1, x: 0, y: 0 };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const btnCls =
  "grid size-9 place-items-center rounded-full bg-black/50 text-white transition hover:bg-black/70 disabled:opacity-40 disabled:hover:bg-black/50";

export function PhotoLightbox({
  items,
  index,
  onIndexChange,
  onClose,
  hasMore,
  onLoadMore,
}: {
  items: LightboxPhoto[];
  /** null = 关闭 */
  index: number | null;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  /** 列表尾部之后还有未加载的分页 */
  hasMore?: boolean;
  onLoadMore?: () => void;
}) {
  const photo = index != null && index >= 0 ? items[index] : undefined;
  const open = photo !== undefined;

  const [view, setView] = useState<View>(RESET_VIEW);
  const [gesturing, setGesturing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  // 进行中的指针（拖拽/捏合共用）
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDist = useRef(0);
  const pinchMid = useRef({ x: 0, y: 0 });
  /** 本轮手势出现过双指：抬指阶段禁止滑动切换误触发 */
  const pinched = useRef(false);
  const swipeDx = useRef(0);
  const moved = useRef(false);
  /** 到末尾按「下一张」触发加载后，新页到达时自动前进 */
  const pendingAdvance = useRef(false);

  /** 平移边界：缩放后的图至少留 PAN_MARGIN px 在舞台内 */
  const clampView = useCallback((v: View): View => {
    if (v.scale <= 1) return RESET_VIEW;
    const img = imgRef.current;
    const stage = stageRef.current;
    if (!img || !stage) return v;
    // offsetWidth/Height 是未变换的布局尺寸，不受 transform 影响
    const limitX = Math.max(0, (img.offsetWidth * v.scale + stage.clientWidth) / 2 - PAN_MARGIN);
    const limitY = Math.max(0, (img.offsetHeight * v.scale + stage.clientHeight) / 2 - PAN_MARGIN);
    return { ...v, x: clamp(v.x, -limitX, limitX), y: clamp(v.y, -limitY, limitY) };
  }, []);

  /** 以舞台坐标 (px,py)（相对中心）为锚，把倍率从 v.scale 变到 next(v.scale) */
  const zoomAt = useCallback(
    (next: (cur: number) => number, px: number, py: number) => {
      setView((v) => {
        const scale = clamp(next(v.scale), MIN_SCALE, MAX_SCALE);
        if (scale <= 1) return RESET_VIEW;
        const k = scale / v.scale;
        return clampView({ scale, x: px - k * (px - v.x), y: py - k * (py - v.y) });
      });
    },
    [clampView],
  );

  const stagePoint = useCallback((clientX: number, clientY: number) => {
    const el = stageRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: clientX - r.left - r.width / 2, y: clientY - r.top - r.height / 2 };
  }, []);

  const goto = useCallback(
    (i: number) => {
      if (i < 0) return;
      if (i >= items.length) {
        // 尾部还有分页：拉取并挂起，新页到达后由下方 effect 前进
        if (hasMore && onLoadMore) {
          pendingAdvance.current = true;
          onLoadMore();
        }
        return;
      }
      onIndexChange(i);
    },
    [items.length, hasMore, onLoadMore, onIndexChange],
  );

  // 换图 / 重开：重置变换与加载态（打开路径不经过 goto，必须在这里兜底）
  const photoId = photo?.id;
  useEffect(() => {
    setView(RESET_VIEW);
    setLoaded(false);
  }, [photoId]);

  // 列表因刷新收缩导致 index 越界时，同步通知父层关闭，
  // 防止之后分页增长让灯箱凭空重新弹出
  useEffect(() => {
    if (index != null && index >= items.length) onClose();
  }, [index, items.length, onClose]);

  // 挂起的「下一张」：新页追加后自动前进
  useEffect(() => {
    if (pendingAdvance.current && index != null && index < items.length - 1) {
      pendingAdvance.current = false;
      onIndexChange(index + 1);
    }
  }, [items.length, index, onIndexChange]);

  // 键盘：Esc 关闭，←/→ 切换。index 走 ref 取最新值——
  // 监听器随 effect 重挂有延迟，快速连按（按住方向键）会丢步
  const indexRef = useRef(index);
  indexRef.current = index;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goto((indexRef.current ?? 0) - 1);
      else if (e.key === "ArrowRight") goto((indexRef.current ?? 0) + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, goto, onClose]);

  // 打开：锁页面滚动 + 焦点移入弹层，关闭后归还原焦点
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    stageRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open]);

  // 滚轮缩放需要非 passive 监听才能阻止默认滚动
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !open) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = stagePoint(e.clientX, e.clientY);
      zoomAt((cur) => cur * Math.exp(-e.deltaY * 0.0022), p.x, p.y);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [open, stagePoint, zoomAt]);

  // 预加载相邻原图
  useEffect(() => {
    if (index == null) return;
    for (const i of [index - 1, index + 1]) {
      const it = items[i];
      if (it) new Image().src = it.imageUrl;
    }
  }, [index, items]);

  if (typeof document === "undefined") return null;

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved.current = false;
    swipeDx.current = 0;
    const pts = [...pointers.current.values()];
    if (pts.length === 2 && pts[0] && pts[1]) {
      pinched.current = true;
      pinchDist.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchMid.current = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      setGesturing(true); // 捏合期间关掉过渡，跟手
    } else if (view.scale > 1) {
      setGesturing(true);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const cur = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, cur);
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) moved.current = true;

    const pts = [...pointers.current.values()];
    if (pts.length === 2 && pts[0] && pts[1]) {
      // 捏合：先跟随两指中点平移，再以中点为锚缩放
      const [a, b] = [pts[0], pts[1]];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const midClient = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const ratio = pinchDist.current > 0 ? dist / pinchDist.current : 1;
      const midDx = midClient.x - pinchMid.current.x;
      const midDy = midClient.y - pinchMid.current.y;
      const mid = stagePoint(midClient.x, midClient.y);
      setView((v) => {
        const scale = clamp(v.scale * ratio, MIN_SCALE, MAX_SCALE);
        if (scale <= 1) return RESET_VIEW;
        const k = scale / v.scale;
        const x0 = v.x + midDx;
        const y0 = v.y + midDy;
        return clampView({ scale, x: mid.x - k * (mid.x - x0), y: mid.y - k * (mid.y - y0) });
      });
      pinchDist.current = dist;
      pinchMid.current = midClient;
    } else if (view.scale > 1) {
      setView((v) => clampView({ ...v, x: v.x + dx, y: v.y + dy }));
    } else if (!pinched.current) {
      swipeDx.current += dx;
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    pinchDist.current = 0;
    if (pointers.current.size === 0) {
      setGesturing(false);
      if (!pinched.current && view.scale <= 1 && Math.abs(swipeDx.current) > SWIPE_PX) {
        goto((index ?? 0) + (swipeDx.current < 0 ? 1 : -1));
      }
      pinched.current = false;
      swipeDx.current = 0;
    }
  }

  // 点图：1 倍时放大到点击处，放大态复位（拖拽/滑动后不触发）
  function onImageClick(e: React.MouseEvent) {
    if (moved.current || pinched.current) return;
    e.stopPropagation();
    const p = stagePoint(e.clientX, e.clientY);
    zoomAt((cur) => (cur > 1 ? 1 : CLICK_SCALE), p.x, p.y);
  }

  // 点空白（未发生拖拽）关闭
  function onStageClick(e: React.MouseEvent) {
    if (e.target === stageRef.current && !moved.current) onClose();
  }

  return createPortal(
    <AnimatePresence>
      {open && photo && (
        <motion.div
          key="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={photo.title || "照片预览"}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {/* 舞台：手势层。键盘交互由全局 keydown 承担 */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: 手势舞台 */}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: Esc 在 window keydown 处理 */}
          <div
            ref={stageRef}
            tabIndex={-1}
            className="absolute inset-0 grid place-items-center overflow-hidden outline-none [touch-action:none]"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onClick={onStageClick}
          >
            {!loaded && (
              <div className="absolute size-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            )}
            {/* 缩放/平移在包装层上做——motion 组件会接管 img 自身的 transform */}
            <div
              className={gesturing ? "" : "transition-transform duration-150"}
              style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
            >
              {/* biome-ignore lint/a11y/noStaticElementInteractions: 点图缩放，键盘走全局监听 */}
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: 同上 */}
              {/* biome-ignore lint/performance/noImgElement: MinIO 原图，灯箱直连 */}
              <img
                key={photo.id}
                ref={imgRef}
                src={photo.imageUrl}
                alt={photo.title || "照片"}
                draggable={false}
                onLoad={() => setLoaded(true)}
                onClick={onImageClick}
                className={`max-h-[88dvh] max-w-[92vw] select-none object-contain transition-opacity duration-200 ${
                  loaded ? "opacity-100" : "opacity-0"
                } ${view.scale > 1 ? (gesturing ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"}`}
              />
            </div>
          </div>

          {/* 顶栏 */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between p-3">
            <span className="rounded-full bg-black/50 px-3 py-1.5 text-xs text-white">
              {(index ?? 0) + 1} / {items.length}
              {hasMore ? "+" : ""}
            </span>
            <div className="pointer-events-auto flex items-center gap-1.5">
              <button
                type="button"
                aria-label="缩小"
                className={btnCls}
                disabled={view.scale <= MIN_SCALE}
                onClick={() => zoomAt((cur) => cur / 1.5, 0, 0)}
              >
                <ZoomOut className="size-4" />
              </button>
              <span className="min-w-12 text-center text-xs text-white/80">
                {Math.round(view.scale * 100)}%
              </span>
              <button
                type="button"
                aria-label="放大"
                className={btnCls}
                disabled={view.scale >= MAX_SCALE}
                onClick={() => zoomAt((cur) => cur * 1.5, 0, 0)}
              >
                <ZoomIn className="size-4" />
              </button>
              {view.scale > 1 && (
                <button
                  type="button"
                  aria-label="重置缩放"
                  className={btnCls}
                  onClick={() => setView(RESET_VIEW)}
                >
                  <RotateCcw className="size-4" />
                </button>
              )}
              <a
                href={photo.imageUrl}
                download
                aria-label="下载原图"
                className={btnCls}
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="size-4" />
              </a>
              <button type="button" aria-label="关闭" className={btnCls} onClick={onClose}>
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* 左右切换 */}
          <button
            type="button"
            aria-label="上一张"
            className={`${btnCls} absolute left-3 top-1/2 -translate-y-1/2`}
            disabled={(index ?? 0) <= 0}
            onClick={() => goto((index ?? 0) - 1)}
          >
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            aria-label="下一张"
            className={`${btnCls} absolute right-3 top-1/2 -translate-y-1/2`}
            disabled={(index ?? 0) >= items.length - 1 && !hasMore}
            onClick={() => goto((index ?? 0) + 1)}
          >
            <ChevronRight className="size-5" />
          </button>

          {/* 标题 / 描述 */}
          {(photo.title || photo.description) && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 pt-10 text-white">
              {photo.title && <p className="text-sm font-medium">{photo.title}</p>}
              {photo.description && (
                <p className="mt-0.5 line-clamp-2 text-xs text-white/80">{photo.description}</p>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
