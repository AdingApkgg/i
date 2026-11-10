import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(fileURLToPath(new URL("../assets/", import.meta.url)));
const catalog = JSON.parse(
  await readFile(new URL("../assets/model_list.json", import.meta.url), "utf8"),
);

describe("Live2D 仓内资源完整性", () => {
  it("所有换装的模型、贴图、物理、表情和动作都有本地文件，且不能指向站外", async () => {
    const failures: string[] = [];
    const models: string[] = catalog.models.flat();
    expect(models).toHaveLength(86);
    for (const model of models) {
      const entry = resolve(root, "model", model, "index.json");
      const settings = JSON.parse(await readFile(entry, "utf8"));
      const refs = [
        settings.model,
        ...settings.textures,
        settings.physics,
        settings.pose,
        ...(
          Object.values(settings.motions ?? {}).flat() as { file: string; sound?: string }[]
        ).flatMap((motion) => [motion.file, motion.sound]),
        ...(settings.expressions ?? []).map((expression: { file: string }) => expression.file),
      ].filter(Boolean) as string[];
      for (const ref of refs) {
        const target = resolve(dirname(entry), ref);
        if (/^(?:[a-z]+:|\/\/)/i.test(ref) || !target.startsWith(root + sep)) {
          failures.push(`${model}: external/unsafe asset ${ref}`);
          continue;
        }
        try {
          expect((await readFile(target)).length, `${model}: ${ref}`).toBeGreaterThan(0);
        } catch {
          failures.push(`${model}: missing ${ref}`);
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("文件集合与 SHA-256 锁一致，新增、删改和符号链接都不能悄悄混入", async () => {
    const lock = JSON.parse(await readFile(new URL("../asset-lock.json", import.meta.url), "utf8"));
    const files = await readdir(root, { recursive: true, withFileTypes: true });
    expect(files.filter((file) => file.isSymbolicLink())).toEqual([]);
    const actual: Record<string, string> = {};
    for (const file of files.filter((file) => file.isFile())) {
      const path = resolve(file.parentPath, file.name);
      const key = path
        .slice(root.length + 1)
        .split(sep)
        .join("/");
      actual[key] = createHash("sha256")
        .update(await readFile(path))
        .digest("hex");
    }
    expect(actual).toEqual(lock.files);
  });
});
