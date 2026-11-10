#!/usr/bin/env node
/** 仅在人工审阅资源变更后更新校验锁；不下载、不执行第三方文件。 */
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../assets/", import.meta.url)));
const lockUrl = new URL("../asset-lock.json", import.meta.url);
const lock = JSON.parse(await readFile(lockUrl, "utf8"));
const entries = await readdir(root, { recursive: true, withFileTypes: true });
if (entries.some((entry) => entry.isSymbolicLink())) throw new Error("Live2D 资源不允许符号链接");
const files = {};
for (const entry of entries.filter((entry) => entry.isFile())) {
  const path = resolve(entry.parentPath, entry.name);
  const relative = path
    .slice(root.length + 1)
    .split(sep)
    .join("/");
  files[relative] = createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}
lock.files = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b, "en")));
await writeFile(lockUrl, `${JSON.stringify(lock, null, 2)}\n`);
console.log(`已锁定 ${Object.keys(files).length} 个 Live2D 资源；请审阅 asset-lock.json 的变更。`);
