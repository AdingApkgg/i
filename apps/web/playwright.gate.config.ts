import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

// 独立验证准入：服务必须开启闸门，不运行注册账号／提权的业务准备步骤。
export default defineConfig({
  ...base,
  globalSetup: undefined,
  outputDir: "e2e/.gate-results",
  testIgnore: [],
  testMatch: "webgpu-gate.spec.ts",
});
