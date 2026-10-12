/**
 * 看板娘偏好（是否隐藏、选的人物 / 换装），持久化到 localStorage。
 * 看板娘只在浏览器里懒加载，挂载时再 rehydrate，没有 SSR 水合问题。
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { WAIFU_LS } from "@/lib/live2d/waifu";
import { localStorageWithLegacy } from "./storage";

interface MascotPrefs {
  hidden: boolean;
  /** null = 没手动选过人物（开场随机一套明日奈换装） */
  group: number | null;
  costume: number;
}

interface MascotState extends MascotPrefs {
  /** 已从 localStorage 读出偏好（之前不渲染，避免先显示再消失） */
  ready: boolean;
  hide: () => void;
  show: () => void;
  choose: (group: number, costume: number) => void;
}

/** 旧版逐项存的 key：waifu.hidden / waifu.group / waifu.costume */
function legacyPrefs(): MascotPrefs | null {
  const hidden = localStorage.getItem(WAIFU_LS.hidden);
  const group = localStorage.getItem(WAIFU_LS.group);
  if (hidden === null && group === null) return null;
  return {
    hidden: hidden === "1",
    group: group === null ? null : Number(group),
    costume: Number(localStorage.getItem(WAIFU_LS.costume)) || 0,
  };
}

export const useMascotStore = create<MascotState>()(
  persist(
    (set) => ({
      hidden: false,
      group: null,
      costume: 0,
      ready: false,
      hide: () => set({ hidden: true }),
      show: () => set({ hidden: false }),
      choose: (group, costume) => set({ group, costume }),
    }),
    {
      name: "i.mascot",
      storage: localStorageWithLegacy(legacyPrefs),
      partialize: ({ hidden, group, costume }) => ({ hidden, group, costume }),
      skipHydration: true,
      onRehydrateStorage: () => () => useMascotStore.setState({ ready: true }),
    },
  ),
);
