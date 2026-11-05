import { fileURLToPath } from "node:url";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { reactRouterHonoServer } from "react-router-hono-server/dev";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    tailwindcss(),
    // Hono 服务端入口（API / auth / RSS 等）；必须排在 reactRouter() 之前
    reactRouterHonoServer({ serverEntryPoint: "src/hono.ts" }),
    reactRouter(),
  ],
  // recharts 及 d3 依赖走 ESM 且要按需 tree-shake：SSR 阶段一并打进服务端产物，
  // 免得镜像 node_modules 少了新依赖就启动失败
  ssr: { noExternal: [/^recharts/] },
  resolve: {
    alias: {
      "@/": fileURLToPath(new URL("./src/", import.meta.url)),
      // tokens 住在共享包里：CSS 的 @import 不支持 exports 映射，这里显式指过去
      "@i/ui/tokens/": fileURLToPath(new URL("../../packages/ui/src/tokens/", import.meta.url)),
    },
  },
  server: { port: 3000 },
});
