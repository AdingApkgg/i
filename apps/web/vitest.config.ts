import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@/": fileURLToPath(new URL("./src/", import.meta.url)),
      // RSC 守卫包在 Node 测试环境里会直接抛错，换成空模块
      "server-only": fileURLToPath(new URL("./test/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
