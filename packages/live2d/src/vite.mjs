// @ts-check
/** 构建工具适配独立于浏览器入口；原生 ESM 可直接由 Node 加载。 */
import { cp, readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const assets = resolve(fileURLToPath(new URL("../assets/", import.meta.url)));
/** @type {Record<string, string>} */
const contentTypes = {
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
};

/** @returns {import("vite").Plugin} */
export function live2dAssets() {
  return {
    name: "i-live2d-assets",
    configureServer(server) {
      server.middlewares.use("/live2d", async (req, res, next) => {
        if (req.method !== "GET" && req.method !== "HEAD") return next();
        try {
          const pathname = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/");
          const path = resolve(assets, `.${pathname}`);
          if (!path.startsWith(assets + sep)) {
            res.statusCode = 403;
            res.end();
            return;
          }
          const bytes = await readFile(path);
          res.setHeader("Content-Type", contentTypes[extname(path)] ?? "application/octet-stream");
          res.setHeader("Content-Length", bytes.length);
          res.setHeader("X-Content-Type-Options", "nosniff");
          res.setHeader("Cache-Control", "no-cache");
          res.end(req.method === "HEAD" ? undefined : bytes);
        } catch (error) {
          if (error instanceof URIError) {
            res.statusCode = 400;
            res.end();
          } else if (
            ["ENOENT", "ENOTDIR", "EISDIR"].includes(
              /** @type {NodeJS.ErrnoException} */ (error).code ?? "",
            )
          ) {
            res.statusCode = 404;
            res.end();
          } else {
            next(error);
          }
        }
      });
    },
    async writeBundle(output) {
      if (this.environment.config.consumer === "server") return;
      if (!output.dir) throw new Error("Live2D assets require a build output directory");
      // 模型不进入 JS bundle；生产服务器只需照常提供 build/client 静态文件。
      await cp(assets, resolve(output.dir, "live2d"), { recursive: true });
    },
  };
}
