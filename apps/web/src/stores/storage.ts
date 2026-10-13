/**
 * zustand persist 用的 localStorage 适配：
 * - 新 key 不存在时，从旧版散落的 key 读出来迁移（老访客的设置不丢）
 * - 服务端渲染 / 无痕模式等拿不到 localStorage 时静默失效
 */
import { createJSONStorage, type StateStorage } from "zustand/middleware";

export function localStorageWithLegacy<T>(legacy: () => T | null) {
  const store: StateStorage = {
    getItem: (name) => {
      try {
        const saved = localStorage.getItem(name);
        if (saved !== null) return saved;
        const old = legacy();
        return old === null ? null : JSON.stringify({ state: old, version: 0 });
      } catch {
        return null;
      }
    },
    setItem: (name, value) => {
      try {
        localStorage.setItem(name, value);
      } catch {
        /* 存不了就算了：只影响下次访问 */
      }
    },
    removeItem: (name) => {
      try {
        localStorage.removeItem(name);
      } catch {
        /* ignore */
      }
    },
  };
  return createJSONStorage(() => store);
}
