/**
 * 一次性迁移：Post / Page 的 contentMd（Hexo Markdown）→ content（Tiptap JSON）。
 *
 *   DATABASE_URL=… bun scripts/migrate-rich-content.ts            # 演练：只转换、校验、出报告，不写库
 *   DATABASE_URL=… bun scripts/migrate-rich-content.ts --write    # 写入 content（已有 content 的跳过）
 *   …  --force    连已有 content 的也重新转换（覆盖后台改过的内容，慎用）
 *   …  --dump=dir 把每篇的转换结果写成 JSON 文件，方便逐篇检查
 *
 * 校验：每篇都过一遍 schema（assertValidDoc），并对比转换前后的纯文本和各类块的数量；
 * 有任何一篇不合法就整体不写库。contentMd 原样保留作备份。
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { db, page, post } from "@i/db";
import { eq } from "drizzle-orm";
import { hexoToDoc, mdastText, parseHexo } from "@/lib/content/from-hexo";
import { plainText } from "@/lib/content/text";
import type { RichNode } from "@/lib/content/types";
import { assertValidDoc } from "@/lib/content/validate.server";

const args = new Set(process.argv.slice(2));
const write = args.has("--write");
const force = args.has("--force");
const dumpDir = process.argv.find((a) => a.startsWith("--dump="))?.slice(7);
if (dumpDir) mkdirSync(dumpDir, { recursive: true });

const norm = (s: string) => s.replace(/\s+/g, "");
/** 代码块和行内代码里的标签是示例，不计数 */
const stripCode = (s: string) =>
  s.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm, "").replace(/`[^`\n]+`/g, "");

/** 源文里各类 Hexo 标签的数量 vs 转换后对应节点的数量 */
const TAGS: [RegExp, string][] = [
  [/\{%\s*note\b/g, "callout"],
  [/\{%\s*hide(Toggle|Block)\b/g, "details"],
  [/\{%\s*tabs\b/g, "tabs"],
  [/\{%\s*btn\b/g, "buttonLink"],
  [/\{%\s*galleryGroup\b/g, "galleryCard"],
  [/\{%\s*gallery\b/g, "gallery"],
  [/\{%\s*dplayer\b/g, "video"],
  [/\{%\s*timeline\b/g, "timeline"],
  [/<meting-js\b/gi, "music"],
  [/^```/gm, "codeBlock"],
];

function countNodes(n: RichNode, acc: Record<string, number> = {}) {
  acc[n.type] = (acc[n.type] ?? 0) + 1;
  for (const c of n.content ?? []) countNodes(c, acc);
  return acc;
}

interface Row {
  kind: "post" | "page";
  id: string;
  label: string;
  md: string;
  hasContent: boolean;
}

const rows: Row[] = [
  ...(await db.select().from(post)).map((p) => ({
    kind: "post" as const,
    id: p.id,
    label: p.slug,
    md: p.contentMd ?? "",
    hasContent: p.content != null,
  })),
  ...(await db.select().from(page)).map((p) => ({
    kind: "page" as const,
    id: p.id,
    label: `page:${p.id}`,
    md: p.contentMd ?? "",
    hasContent: p.content != null,
  })),
];

let invalid = 0;
const results: { row: Row; doc: unknown }[] = [];
for (const row of rows) {
  if (!row.md.trim() || (row.hasContent && !force)) continue;
  const { doc, warnings, fallback } = hexoToDoc(row.md);
  const problems: string[] = [];
  try {
    assertValidDoc(doc);
  } catch (e) {
    invalid++;
    problems.push(`schema 不合法：${(e as Error).message}`);
  }

  // 纯文本对比（只比字符，忽略空白）：转换前后丢了多少字
  const before = norm(mdastText(parseHexo(row.md).tree));
  const after = norm(plainText(doc));
  const lost = before.length ? Math.max(0, before.length - after.length) / before.length : 0;
  if (lost > 0.01)
    problems.push(`文字少了 ${(lost * 100).toFixed(1)}%（${before.length} → ${after.length}）`);

  // 标签数量对比（MDX 回退时标签必然对不上，单独提示）
  const nodes = countNodes(doc);
  for (const [re, type] of TAGS) {
    const want =
      ((type === "codeBlock" ? row.md : stripCode(row.md)).match(re) ?? []).length /
      (type === "codeBlock" ? 2 : 1);
    const got = nodes[type] ?? 0;
    if (Math.floor(want) !== got)
      problems.push(`${type}: 源文 ${Math.floor(want)} 个，转换后 ${got} 个`);
  }

  const flag = problems.length || fallback ? "⚠" : "✓";
  console.log(`${flag} ${row.label}${fallback ? "（MDX 回退）" : ""}`);
  for (const p of problems) console.log(`    - ${p}`);
  for (const w of warnings) console.log(`    · ${w}`);
  if (dumpDir)
    writeFileSync(
      join(dumpDir, `${row.label.replace(/[^\w-]/g, "_")}.json`),
      JSON.stringify(doc, null, 2),
    );
  results.push({ row, doc });
}

console.log(`\n共 ${results.length} 篇，schema 不合法 ${invalid} 篇`);
if (!write) {
  console.log("演练模式，没有写库（加 --write 写入）");
  process.exit(invalid ? 1 : 0);
}
if (invalid) {
  console.error("有不合法的文档，整体不写库");
  process.exit(1);
}
await db.transaction(async (tx) => {
  for (const { row, doc } of results) {
    const content = doc as { type: "doc" };
    if (row.kind === "post") await tx.update(post).set({ content }).where(eq(post.id, row.id));
    else await tx.update(page).set({ content }).where(eq(page.id, row.id));
  }
});
console.log(`已写入 ${results.length} 篇`);
process.exit(0);
