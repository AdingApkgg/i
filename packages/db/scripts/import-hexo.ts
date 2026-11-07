/**
 * One-shot importer: pull real content from the old Hexo (Butterfly) blog source
 * into the v2 domains. Run with HEXO_SRC pointing at the blog's `source/` dir.
 *
 *   HEXO_SRC=/app/.import/hexo/source bun packages/db/scripts/import-hexo.ts
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { inArray } from "drizzle-orm";
import matter from "gray-matter";
import { parse as parseYaml } from "yaml";
import { db } from "../src/client";
import { friend, moment, movie, page, photo, post, project, sponsor, track } from "../src/schema";

const SRC = process.env.HEXO_SRC ?? "/app/.import/hexo/source";

function stripMd(s: string): string {
  return s
    .replace(/\{%[^%]*%\}/g, "") // hexo tags {% ... %}
    .replace(/<[^>]+>/g, "") // html/meting-js
    .replace(/[#>*`_~\-|]/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------- 博客文章 ----------------
async function importPosts() {
  const dir = join(SRC, "_posts");
  if (!existsSync(dir)) return 0;
  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  let n = 0;
  for (const f of files) {
    const raw = readFileSync(join(dir, f), "utf8");
    const { data, content } = matter(raw);
    const stem = f.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");
    const slug = String(data.abbrlink ?? data.slug ?? stem).trim();
    const title = String(data.title ?? stem).trim();
    const date = data.date ? new Date(data.date as string) : new Date();
    const tags = ([] as unknown[])
      .concat((data.tags as unknown[]) ?? [])
      .concat((data.categories as unknown[]) ?? [])
      .flat()
      .map((t) => String(t))
      .filter(Boolean)
      .slice(0, 8);
    const excerpt = (data.description ? String(data.description) : stripMd(content)).slice(0, 160);
    const cover = data.cover ?? data.top_img ?? null;
    const fields = {
      title,
      excerpt,
      contentMd: content,
      tags,
      status: "published",
      publishedAt: date,
      coverUrl: cover ? String(cover) : null,
    };
    await db
      .insert(post)
      .values({ slug, ...fields })
      .onConflictDoUpdate({ target: post.slug, set: fields });
    n++;
  }
  return n;
}

// ---------------- 友链 ----------------
async function importFriends() {
  const file = join(SRC, "_data", "link.yml");
  if (!existsSync(file)) return 0;
  const groups = parseYaml(readFileSync(file, "utf8")) as {
    class_name?: string;
    link_list?: { name?: string; link?: string; avatar?: string; descr?: string }[];
  }[];
  // Keep every group, including "技术支持"（工具站也在这一组，拆开就没法排序了）。
  // Only wipe imported/published rows — live pending/rejected applications survive.
  await db.delete(friend).where(inArray(friend.status, ["active", "outdate"]));
  let n = 0;
  for (const g of groups ?? []) {
    if (!g.class_name) continue;
    for (const l of g.link_list ?? []) {
      if (!l.name || !l.link) continue;
      await db.insert(friend).values({
        name: String(l.name),
        url: String(l.link),
        avatarUrl: l.avatar ? String(l.avatar) : null,
        description: l.descr ? String(l.descr) : null,
        group: String(g.class_name).trim(),
        status: "active",
        sortOrder: n,
      });
      n++;
    }
  }
  return n;
}

// ---------------- 说说 ----------------
async function importMoments() {
  const file = join(SRC, "_data", "shuoshuo.yml");
  if (!existsSync(file)) return 0;
  const list = parseYaml(readFileSync(file, "utf8")) as {
    date?: string;
    content?: string;
    tag?: string;
  }[];
  await db.delete(moment);
  let n = 0;
  for (const s of list ?? []) {
    if (!s.content) continue;
    await db.insert(moment).values({
      content: String(s.content).trim(),
      mood: s.tag ? String(s.tag) : null,
      createdAt: s.date ? new Date(s.date) : new Date(),
    });
    n++;
  }
  return n;
}

// Old-site images live under gh.saop.cc/img/ ; absolute urls pass through.
function resolveImg(p: string): string {
  const s = p.trim();
  if (/^https?:\/\//.test(s)) return s;
  return `https://gh.saop.cc${s.startsWith("/") ? "" : "/"}${s}`;
}

// ---------------- 影视 (best-effort: ## 标题 + dplayer 海报) ----------------
async function importMovies() {
  const file = join(SRC, "movie", "index.md");
  if (!existsSync(file)) return 0;
  const lines = matter(readFileSync(file, "utf8")).content.split("\n");
  await db.delete(movie);
  let n = 0;
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i]!.match(/^##\s+(.+)/);
    if (!h) continue;
    const title = h[1]!.trim();
    let pic: string | null = null;
    for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
      const m = lines[j]!.match(/pic=["']?([^"'\s]+\.(?:webp|png|jpe?g|gif))/i);
      if (m) {
        pic = m[1]!;
        break;
      }
    }
    await db
      .insert(movie)
      .values({ title, status: "看过", coverUrl: pic ? resolveImg(pic) : null, sortOrder: n });
    n++;
  }
  return n;
}

// ---------------- 相册 (best-effort: 各相册组图片，每组封顶 30) ----------------
async function importGallery() {
  const idx = join(SRC, "gallery", "index.md");
  if (!existsSync(idx)) return 0;
  const groups = [
    ...readFileSync(idx, "utf8").matchAll(
      /galleryGroup\s+'([^']+)'\s+'[^']*'\s+'\/gallery\/([^/']+)\//g,
    ),
  ];
  await db.delete(photo);
  let n = 0;
  for (const g of groups) {
    const name = g[1]!;
    const folder = g[2]!;
    const sub = join(SRC, "gallery", folder, "index.md");
    if (!existsSync(sub)) continue;
    const imgs = [...readFileSync(sub, "utf8").matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)]
      .map((m) => m[1]!)
      .filter((u) => /\.(webp|png|jpe?g|gif)$/i.test(u))
      .slice(0, 30);
    for (const p of imgs) {
      await db.insert(photo).values({ title: name, imageUrl: resolveImg(p), sortOrder: n });
      n++;
    }
  }
  return n;
}

// ---------------- 音乐 (best-effort: 系列/艺术家 ## 标题) ----------------
async function importMusic() {
  const file = join(SRC, "music", "index.md");
  if (!existsSync(file)) return 0;
  const content = matter(readFileSync(file, "utf8")).content;
  const heads = [...content.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1]!.trim());
  await db.delete(track);
  let n = 0;
  for (const h of heads) {
    // "ソードアート・オンライン（刀剑神域…）" → keep the 日文 head, note the 中文
    const jp = h.replace(/（.*?）|\(.*?\)/g, "").trim();
    await db.insert(track).values({ title: jp || h, note: h, status: "在听", sortOrder: n });
    n++;
  }
  return n;
}

// ---------------- 作品（projects/index.md 的数据源 _data/projects.yml） ----------------
async function importProjects() {
  const file = join(SRC, "_data", "projects.yml");
  if (!existsSync(file)) return 0;
  const list = parseYaml(readFileSync(file, "utf8")) as {
    name?: string;
    link?: string;
    img?: string;
    tag?: string;
    desc?: string;
    repo?: string;
  }[];
  await db.delete(project);
  let n = 0;
  for (const p of list ?? []) {
    if (!p.name || !p.link) continue;
    await db.insert(project).values({
      name: String(p.name),
      link: String(p.link),
      repo: p.repo ? String(p.repo) : null,
      imageUrl: p.img ? resolveImg(String(p.img)) : null,
      tag: p.tag ? String(p.tag) : null,
      description: p.desc ? String(p.desc) : null,
      sortOrder: n,
    });
    n++;
  }
  return n;
}

// ---------------- 赞助墙（donate/index.md 表格 + 可选 SPONSORS_JSON 目录） ----------------
// 金额是自由文本（“5 B币”“10B币+9电池”“两个月充电”）：
// 解析出前导数字进 amountCents 供汇总，原文一律留在 amountText，展示以原文为准。
const CNY_PLATFORMS = new Set(["微信", "支付宝", "QQ"]);
const PLATFORMS = new Set([...CNY_PLATFORMS, "爱发电", "B站", "Patreon", "其它"]);

/** 金额可能是“5 B币”“10B币+9电池”“180¥”“10.00”……：取前面的数字，原文别丢 */
function parseAmount(
  raw: string,
  platformHint?: string,
): { cents: number; platform: string } | null {
  const s = raw.trim();
  if (!s) return null;
  // 金额原文五花八门：￥5.00、10￥、11.45 CNY、5 USDC、180¥；先剥掉货币记号再取数
  const num = s.replace(/[￥¥]/g, " ").match(/(\d+(?:\.\d+)?)/);
  if (/电池|充电|B币/.test(s)) {
    return { cents: num ? Math.round(Number(num[1]) * 100) : 0, platform: "B站" };
  }
  const hinted = platformHint && PLATFORMS.has(platformHint) ? platformHint : null;
  if (num && (/￥|¥|CNY|USDC/i.test(s) || CNY_PLATFORMS.has(hinted ?? ""))) {
    return { cents: Math.round(Number(num[1]) * 100), platform: hinted ?? "微信" };
  }
  return { cents: 0, platform: hinted ?? "其它" };
}

/** 只是“数字+货币记号”的金额由 platform + amountCents 统一渲染成“￥10.00”；
 * 留着原文会混出 180¥ / 10 CNY / 5 USDC，带文字的（两个月充电）才保留原文。 */
const amountLabel = (raw: string) =>
  /^[\d\s.]+$/.test(raw.replace(/[￥¥]|CNY|USDC|RMB|元/gi, "")) ? "" : raw;

async function importSponsors() {
  const file = join(SRC, "donate", "index.md");
  if (!existsSync(file)) return 0;
  const lines = matter(readFileSync(file, "utf8")).content.split("\n");
  type Row = {
    name: string;
    platform: string;
    cents: number;
    text: string;
    at: Date;
    avatar?: string;
    message?: string;
  };
  const rows: Row[] = [];
  let inTable = false;
  for (const line of lines) {
    // 表头“昵称 | 平台 | 金额 | 日期 | 留言”，据此认表
    if (/^\|\s*昵称\s*\|/.test(line)) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (!line.trim().startsWith("|")) {
      inTable = false;
      continue;
    }
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    if (cells.length < 4 || /^:?-{3,}/.test(cells[0]!)) continue;
    const [name, platform, amount, date, message] = cells as [
      string,
      string,
      string,
      string,
      string?,
    ];
    const cleanName = name
      .replace(/\*\*/g, "")
      .trim()
      .replace(/^(null|undefined)$/i, "匿名");
    if (!cleanName || /^[.·…]+$/.test(cleanName)) continue;
    const parsed = amount ? parseAmount(amount, platform) : null;
    if (!parsed) continue;
    const at = date?.match(/^(\d{2})-(\d{2})-(\d{2})$/)
      ? new Date(
          Date.UTC(
            2000 + Number(date.slice(0, 2)),
            Number(date.slice(3, 5)) - 1,
            Number(date.slice(6, 8)),
          ),
        )
      : new Date();
    rows.push({
      name: cleanName,
      platform: parsed.platform,
      cents: parsed.cents,
      text: amountLabel(amount),
      at,
      message: message && message !== "null" ? message : undefined,
    });
  }

  // 新版 JSON 赞助数据（B站 为主，没有平台列，靠金额文本推断）
  const jsonDir = process.env.SPONSORS_JSON;
  const extra: Row[] = [];
  if (jsonDir && existsSync(jsonDir)) {
    for (const f of readdirSync(jsonDir).filter((f) => f.endsWith(".json"))) {
      const d = JSON.parse(readFileSync(join(jsonDir, f), "utf8")) as {
        name?: string;
        avatar?: string;
        date?: string;
        amount?: string;
        message?: string;
      };
      const parsed = d.amount ? parseAmount(d.amount) : null;
      if (!d.name || !parsed) continue;
      extra.push({
        name: d.name,
        platform: parsed.platform,
        cents: parsed.cents,
        text: d.amount ? amountLabel(d.amount) : "",
        at: d.date ? new Date(d.date) : new Date(),
        avatar: d.avatar,
        message: d.message,
      });
    }
  }

  await db.delete(sponsor);
  let n = 0;
  const all = [...rows, ...extra].sort((a, b) => b.at.getTime() - a.at.getTime());
  for (const r of all) {
    await db.insert(sponsor).values({
      name: r.name,
      platform: r.platform,
      amountCents: r.cents,
      amountText: r.text || null,
      avatarUrl: r.avatar ?? null,
      message: r.message ?? null,
      sponsoredAt: r.at,
      sortOrder: n,
    });
    n++;
  }
  return n;
}

// ---------------- 译文（_posts/ja、_posts/en）：slug 加语言后缀，translationOf 指原文 ----------------
async function importTranslations() {
  let n = 0;
  for (const lang of ["ja", "en"] as const) {
    const dir = join(SRC, "_posts", lang);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
      const { data, content } = matter(readFileSync(join(dir, f), "utf8"));
      const stem = f.replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");
      const original = String(data.abbrlink ?? data.slug ?? stem).trim();
      const title = String(data.title ?? stem).trim();
      const fields = {
        slug: `${original}-${lang}`,
        title,
        excerpt: (data.description ? String(data.description) : stripMd(content)).slice(0, 160),
        contentMd: content,
        tags: ([] as unknown[])
          .concat((data.tags as unknown[]) ?? [])
          .flat()
          .map((t) => String(t))
          .filter(Boolean)
          .slice(0, 8),
        status: "published",
        lang,
        translationOf: original,
        publishedAt: data.date ? new Date(data.date as string) : new Date(),
        coverUrl: data.cover ? resolveImg(String(data.cover)) : null,
      };
      await db.insert(post).values(fields).onConflictDoUpdate({ target: post.slug, set: fields });
      n++;
    }
  }
  return n;
}

// ---------------- 富文本页：music / movie / about / donate / video 整页 ----------------
async function importPages() {
  let n = 0;
  for (const [key, title, rel] of [
    ["music", "音乐", "music/index.md"],
    ["movie", "影视", "movie/index.md"],
    ["about", "关于", "about/index.md"],
    ["donate", "小站赞助墙", "donate/index.md"],
    ["video", "视频", "video/index.md"],
  ] as const) {
    const file = join(SRC, rel);
    if (!existsSync(file)) continue;
    let { content } = matter(readFileSync(file, "utf8"));
    // 赞助墙表格已经进 Sponsor 表，正文里再留一份就重复了
    if (key === "donate") {
      const keep: string[] = [];
      let inTable = false;
      for (const line of content.split("\n")) {
        if (/^\|\s*昵称\s*\|/.test(line)) inTable = true;
        else if (inTable && !line.trim().startsWith("|")) inTable = false;
        if (!inTable) keep.push(line);
      }
      // “累计收到投喂”也在赞助墙里重算，正文只留说明
      content = keep
        .join("\n")
        .replace(/^累计收到投喂.*$/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }
    // 关于页的建站计时改由前端算（原来的 <script> + setInterval 在新站不执行）
    if (key === "about") {
      content = content
        .replace(/<script[\s\S]*?<\/script>/g, "")
        .replace(/^.*id="htmer_time".*$/gm, "")
        .replace(/\n\s*\n\s*\n+/g, "\n\n")
        .trim();
    }
    await db
      .insert(page)
      .values({ id: key, title, contentMd: content })
      .onConflictDoUpdate({ target: page.id, set: { title, contentMd: content } });
    n++;
  }
  return n;
}

// Optional arg re-imports a single domain (each importer wipes its own table):
//   bun packages/db/scripts/import-hexo.ts friends
const IMPORTERS = {
  pages: importPages,
  posts: importPosts,
  translations: importTranslations,
  friends: importFriends,
  moments: importMoments,
  movies: importMovies,
  photos: importGallery,
  tracks: importMusic,
  projects: importProjects,
  sponsors: importSponsors,
} as const;

async function main() {
  console.log("HEXO_SRC =", SRC);
  const only = process.argv[2] as keyof typeof IMPORTERS | undefined;
  if (only && !IMPORTERS[only]) {
    throw new Error(`unknown domain "${only}" — one of: ${Object.keys(IMPORTERS).join(", ")}`);
  }
  const parts: string[] = [];
  for (const [key, run] of Object.entries(IMPORTERS)) {
    if (only && key !== only) continue;
    parts.push(`${key}=${await run()}`);
  }
  console.log(`✓ imported: ${parts.join(" ")}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
