import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer as createHttpServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { build, createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { live2dAssets } from "./vite.mjs";

// 使用真实 HTTP 和 Vite 构建，捕捉只在 dev 能用、生产缺资源的回归。
describe("Live2D 静态资源适配", () => {
  let vite: ViteDevServer;
  let http: Server;
  let directory: string;
  let origin: string;

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), "i-live2d-assets-"));
    vite = await createServer({
      configFile: false,
      root: directory,
      plugins: [live2dAssets()],
      server: { middlewareMode: true },
      logLevel: "silent",
    });
    http = createHttpServer(vite.middlewares);
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    const address = http.address();
    if (!address || typeof address === "string") throw new Error("HTTP server did not start");
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await vite?.close();
    if (http)
      await new Promise<void>((resolve, reject) =>
        http.close((error) => (error ? reject(error) : resolve())),
      );
    if (directory) await rm(directory, { recursive: true, force: true });
  });

  it("构建适配入口能直接由 Node 导入，不依赖 TypeScript loader", async () => {
    const { stdout } = await promisify(execFile)(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        "import('@i/live2d/vite').then(m => console.log(m.live2dAssets().name))",
      ],
      { cwd: fileURLToPath(new URL("../", import.meta.url)) },
    );
    expect(stdout.trim()).toBe("i-live2d-assets");
  });

  it("dev 同源提供目录、JS 类型和 HEAD，查询参数不影响文件定位", async () => {
    const catalog = await fetch(`${origin}/live2d/model_list.json?v=local`);
    expect(catalog.status).toBe(200);
    expect(catalog.headers.get("content-type")).toContain("application/json");
    expect((await catalog.json()).models).toHaveLength(11);
    const core = await fetch(`${origin}/live2d/core/live2d.min.js`, { method: "HEAD" });
    expect(core.status).toBe(200);
    expect(core.headers.get("content-type")).toContain("text/javascript");
    expect(Number(core.headers.get("content-length"))).toBeGreaterThan(100_000);
    expect(await core.text()).toBe("");
  });

  it("拒绝编码后的目录穿越与无效 URL，缺失资源不退回 HTML", async () => {
    expect((await fetch(`${origin}/live2d/%2e%2e%2fpackage.json`)).status).toBe(403);
    expect((await fetch(`${origin}/live2d/%ZZ`)).status).toBe(400);
    const missing = await fetch(`${origin}/live2d/no-such-model.moc`);
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe("");
  });

  it("生产构建包含同一套资源，Node 服务器无须解析源码包或联网下载", async () => {
    await writeFile(join(directory, "index.html"), "<!doctype html><html><body>test</body></html>");
    const out = join(directory, "build");
    await build({
      configFile: false,
      root: directory,
      plugins: [live2dAssets()],
      logLevel: "silent",
      build: { outDir: out },
    });
    const source = await readFile(new URL("../assets/core/live2d.min.js", import.meta.url));
    const built = await readFile(join(out, "live2d/core/live2d.min.js"));
    expect(createHash("sha256").update(built).digest("hex")).toBe(
      createHash("sha256").update(source).digest("hex"),
    );
    const catalog = JSON.parse(await readFile(join(out, "live2d/model_list.json"), "utf8"));
    expect(catalog.models.flat()).toHaveLength(86);
    expect(await readFile(join(out, "live2d/licenses/live2d-api.LICENSE.txt"), "utf8")).toContain(
      "MIT License",
    );
  }, 30_000);
});
