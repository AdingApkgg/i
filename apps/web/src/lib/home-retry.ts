import type { HomeState } from "./home-content";

/** 只管理一个首页模块的读取；不缓存、不自动重试、不持有恢复模板。 */
export function createHomeRetry<T>(
  read: (signal: AbortSignal) => Promise<T[]>,
  update: (state: HomeState<T>) => void,
  finish: () => void,
) {
  let active: AbortController | undefined;
  return {
    async run() {
      if (active) return;
      const controller = new AbortController();
      active = controller;
      update({ status: "loading", items: [] });
      try {
        let result: HomeState<T>;
        try {
          result = { status: "ready", items: await read(controller.signal) };
        } catch {
          result = { status: "error", items: [] };
        }
        // 离页／新 loader 数据会取消旧请求；上游即使忽略信号也不能发布迟到结果。
        if (!controller.signal.aborted) {
          update(result);
          finish();
        }
      } finally {
        if (active === controller) active = undefined;
      }
    },
    cancel() {
      active?.abort();
      active = undefined;
    },
  };
}
