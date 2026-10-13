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
  resolve: {
    alias: { "@/": fileURLToPath(new URL("./src/", import.meta.url)) },
  },
  server: { port: 3000 },
});
