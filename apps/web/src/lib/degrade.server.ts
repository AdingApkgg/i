/**
 * 数据库等依赖出错时的降级（请求级状态，AsyncLocalStorage）。
 *
 * 页面 loader 查询失败时降级成空数据继续渲染（不至于整页 500），但这样的响应是 200，
 * 会被 CDN 当正常内容缓存。降级时打个标记，缓存中间件（server/cache.ts）看到就改成不缓存。
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { ORPCError } from "@orpc/server";

const state = new AsyncLocalStorage<{ degraded: boolean }>();

/** 每个请求一份状态；缓存中间件在最外层调用 */
export function withRequestState<T>(fn: () => Promise<T>) {
  return state.run({ degraded: false }, fn);
}

export const isDegraded = () => state.getStore()?.degraded === true;

/** 标记本次响应是降级产物（不进缓存），并记日志 */
export function markDegraded(err: unknown) {
  const s = state.getStore();
  if (s) s.degraded = true;
  console.error("[degraded]", err);
}

const isNotFound = (err: unknown) => err instanceof ORPCError && err.code === "NOT_FOUND";

/**
 * 次要数据：`.catch(degradeTo([]))` —— 失败时用兜底值继续渲染，并标记本次响应不缓存。
 * NOT_FOUND 是正常的「没有」，不算降级。
 */
export const degradeTo =
  <T>(fallback: T) =>
  (err: unknown): T => {
    if (!isNotFound(err)) markDegraded(err);
    return fallback;
  };

/** 页面主体：`.catch(notFoundTo(null))` —— 不存在返回兜底值（随后抛 404），其余错误照常抛出（500） */
export const notFoundTo =
  <T>(fallback: T) =>
  (err: unknown): T => {
    if (isNotFound(err)) return fallback;
    throw err;
  };
