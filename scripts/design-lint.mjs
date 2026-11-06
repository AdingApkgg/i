#!/usr/bin/env node
/**
 * 设计系统护栏。基线锁在当前值上，只准下降；`--update` 重写基线。
 *
 * 规则
 *  1 arbitrary       tsx 里 `text-[13px]` 这类任意值类名数量
 *  2 rawPalette      tsx 里 `bg-amber-500` 这类 Tailwind 原生调色板数量
 *  3 colorLiteral    ts/tsx 里 `#rrggbb` / `oklch()` / `rgb()` 数量
 *  4 legacyClass     css 里 .sao-* / .dash-* / .grouped-* 定义数量
 *  5 tokens          主题分层契约（见 checkTokens）
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const WEB = join(ROOT, "apps/web/src");
const TOKENS = join(ROOT, "packages/ui/src/tokens");
const BASELINE = join(ROOT, "scripts/design-baseline.json");
const update = process.argv.includes("--update");
/** 由播放器 JS 在运行时写入，没有静态定义。 */
const RUNTIME_VARS = new Set(["--media-slider-fill", "--media-slider-buffer"]);

const HUES =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const PATTERNS = {
  arbitrary: /\b(?:[a-z-]+)-\[[^\]\s]+\]/g,
  rawPalette: new RegExp(
    `\\b(?:bg|text|border|ring|outline|fill|stroke|divide|from|via|to|decoration|accent|caret|shadow|placeholder)-(?:${HUES})-(?:50|[1-9]00|950)\\b`,
    "g",
  ),
  colorLiteral: /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|\b(?:oklch|rgba?|hsla?)\(/g,
  legacyClass: /^\.(?:sao|dash|grouped)-[a-z0-9-]+/gm,
};

function walk(dir, ext, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry.startsWith(".")) continue;
      walk(full, ext, out);
    } else if (ext.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

const read = (f) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

function count(files, pattern) {
  let hits = 0;
  for (const f of files) hits += (read(f).match(pattern) ?? []).length;
  return hits;
}

const failures = [];
const fail = (rule, message) => failures.push(`${rule}: ${message}`);

function countRule(rule, files, pattern, baseline) {
  const actual = count(files, pattern);
  const allowed = baseline[rule];
  if (actual > allowed) fail(rule, `${actual} > 基线 ${allowed}（超出 ${actual - allowed}）`);
  return actual;
}

const tsx = walk(WEB, [".tsx"]);
const scripts = walk(WEB, [".ts", ".tsx"]);
const css = walk(WEB, [".css"]);
const themeFiles = ["theme-moe.css", "theme-sao.css"].map((f) => join(TOKENS, f));

function themeVars(file) {
  const cssText = read(file);
  const names = new Set();
  for (const m of cssText.matchAll(/(--[a-z0-9-]+)\s*:/g)) names.add(m[1]);
  return names;
}

function checkTokens(globals) {
  const primitiveCss = readFileSync(join(TOKENS, "primitive.css"), "utf8");
  const primitives = [...primitiveCss.matchAll(/(--palette-[a-z]+-\d+)\s*:/g)].map((m) => m[1]);
  if (!primitives.length) fail("tokens", "primitive.css 没有任何色阶");
  if (!/@import "@i\/ui\/tokens\/index\.css";/.test(globals))
    fail("tokens", "globals.css 没有引入 @i/ui/tokens/index.css");
  if (
    !globals.includes(":root:has(.sao-site)") &&
    !readFileSync(themeFiles[1], "utf8").includes(":root:has(.sao-site)")
  ) {
    fail("tokens", "SAO 主题必须限定在 .sao-site 作用域内");
  }

  const declared = new Set();
  for (const file of themeFiles) {
    const label = relative(ROOT, file);
    const body = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const literal = body.match(/#[0-9a-fA-F]{3,8}\b|\b(?:oklch|rgba?)\(/g) ?? [];
    if (literal.length) fail("tokens", `${label} 出现色值字面量 ${literal.slice(0, 3).join(" ")}`);

    const decls = [...body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;}]+)/g)];
    for (const [, name, value] of decls) {
      declared.add(name);
      for (const [, ref] of value.matchAll(/var\((--palette-[a-z]+-\d+)\)/g)) {
        if (!primitives.includes(ref)) fail("tokens", `${label} 引用了不存在的 ${ref}`);
      }
      if (!value.includes("var(") && !/^[\d.]+rem$/.test(value.trim())) {
        fail("tokens", `${label} 的 ${name} 既不是 var() 也不是 rem 刻度`);
      }
    }
  }

  const [moe, sao] = themeFiles.map(themeVars);
  for (const name of moe)
    if (!sao.has(name)) fail("tokens", `theme-sao.css 缺少 ${name}（两个主题的语义集必须一致）`);
  for (const name of sao)
    if (!moe.has(name) && !name.startsWith("--sao-")) fail("tokens", `theme-sao.css 多出 ${name}`);

  // @theme 里映射的每个变量都得有人定义，防止改了名字留下悬空引用
  for (const [, name] of globals.matchAll(/var\((--[a-z0-9-]+)\)/g)) {
    if (declared.has(name) || RUNTIME_VARS.has(name)) continue;
    if (new RegExp(`(^|[\\s{;])${name}\\s*:`).test(globals)) continue;
    fail("tokens", `@theme 引用了没有定义的 ${name}`);
  }
}

const globals = readFileSync(join(WEB, "globals.css"), "utf8");
const baseline =
  update && !existsSync(BASELINE)
    ? { arbitrary: 1e9, rawPalette: 1e9, colorLiteral: 1e9, legacyClass: 1e9 }
    : JSON.parse(readFileSync(BASELINE, "utf8"));
const actual = {
  arbitrary: countRule("arbitrary", tsx, PATTERNS.arbitrary, baseline),
  rawPalette: countRule("rawPalette", tsx, PATTERNS.rawPalette, baseline),
  colorLiteral: countRule("colorLiteral", scripts, PATTERNS.colorLiteral, baseline),
  legacyClass: countRule("legacyClass", css, PATTERNS.legacyClass, baseline),
};
checkTokens(globals);

if (update) {
  writeFileSync(BASELINE, `${JSON.stringify(actual, null, 2)}\n`);
  console.log("基线已更新:", actual);
}

if (failures.length) {
  console.error(`design-lint 失败（${failures.length}）:`);
  for (const f of failures) console.error("  -", f);
  process.exit(1);
}
const room = Object.entries(actual).map(([k, v]) => `${k} ${v}/${baseline[k]}`);
console.log(`design-lint 通过：${room.join("，")}`);
