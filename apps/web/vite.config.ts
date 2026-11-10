import { fileURLToPath } from "node:url";
import { live2dAssets } from "@i/live2d/vite";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { reactRouterHonoServer } from "react-router-hono-server/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    live2dAssets(),
    tailwindcss(),
    // Hono 服务端入口（API / auth / RSS 等）；必须排在 reactRouter() 之前
    reactRouterHonoServer({ serverEntryPoint: "src/hono.ts" }),
    reactRouter(),
  ],
  // recharts 及 d3 依赖走 ESM 且要按需 tree-shake：SSR 阶段一并打进服务端产物，
  // 免得镜像 node_modules 少了新依赖就启动失败
  ssr: { noExternal: [/^recharts/, /^@i\/live2d/] },
  // 沿用 p5 官方生产构建开关，移除诊断翻译的 npm CDN 初始化，保留模块化入口。
  define: { IS_MINIFIED: "true" },
  resolve: {
    alias: {
      "@/": fileURLToPath(new URL("./src/", import.meta.url)),
      // tokens 住在共享包里：CSS 的 @import 不支持 exports 映射，这里显式指过去
      "@i/ui/tokens/": fileURLToPath(new URL("../../packages/ui/src/tokens/", import.meta.url)),
    },
  },
  server: { port: 3000 },
});
