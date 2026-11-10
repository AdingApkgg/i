import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// 公开阅读版只读验收：不运行注册账号／提权的后台 globalSetup，不写数据库。
export default defineConfig({
  ...base,
  globalSetup: undefined,
  testMatch: [
    "asuna-home.spec.ts",
    "navigation.spec.ts",
    "grouped-navigation.spec.ts",
    "navigation-motion.spec.ts",
    "home-capabilities.probe.ts",
    "home-occlusion.probe.ts",
    "home-performance.spec.ts",
    "mascot-dock.probe.ts",
    "live2d.spec.ts",
    "webgpu-gate.spec.ts",
    ...(process.env.SAO_HOME_STATE_URL ? ["home-state.probe.ts"] : []),
  ],
});
