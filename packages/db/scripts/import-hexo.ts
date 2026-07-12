/**
 * One-shot importer: pull real content from the old Hexo (Butterfly) blog source
 * into the v2 domains. Run with HEXO_SRC pointing at the blog's `source/` dir.
 *
 *   HEXO_SRC=/app/.import/hexo/source bun packages/db/scripts/import-hexo.ts
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { parse as parseYaml } from "yaml";
import { db } from "../src/client";

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
    await db.post.upsert({
      where: { slug },
      update: { title, excerpt, contentMd: content, tags, status: "published", publishedAt: date, coverUrl: cover ? String(cover) : null },
      create: { slug, title, excerpt, contentMd: content, tags, status: "published", publishedAt: date, coverUrl: cover ? String(cover) : null },
    });
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
  // Skip the "技术支持" credits group; keep real friend groups.
  await db.friend.deleteMany({});
  let n = 0;
  for (const g of groups ?? []) {
    if (!g.class_name || g.class_name.includes("技术支持")) continue;
    for (const l of g.link_list ?? []) {
      if (!l.name || !l.link) continue;
      await db.friend.create({
        data: {
          name: String(l.name),
          url: String(l.link),
          avatarUrl: l.avatar ? String(l.avatar) : null,
          description: l.descr ? String(l.descr) : null,
          status: "active",
          sortOrder: n,
        },
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
  const list = parseYaml(readFileSync(file, "utf8")) as { date?: string; content?: string; tag?: string }[];
  await db.moment.deleteMany({});
  let n = 0;
  for (const s of list ?? []) {
    if (!s.content) continue;
    await db.moment.create({
      data: {
        content: String(s.content).trim(),
        mood: s.tag ? String(s.tag) : null,
        createdAt: s.date ? new Date(s.date) : new Date(),
      },
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
  await db.movie.deleteMany({});
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
    await db.movie.create({
      data: { title, status: "看过", coverUrl: pic ? resolveImg(pic) : null, sortOrder: n },
    });
    n++;
  }
  return n;
}

// ---------------- 相册 (best-effort: 各相册组图片，每组封顶 30) ----------------
async function importGallery() {
  const idx = join(SRC, "gallery", "index.md");
  if (!existsSync(idx)) return 0;
  const groups = [
    ...readFileSync(idx, "utf8").matchAll(/galleryGroup\s+'([^']+)'\s+'[^']*'\s+'\/gallery\/([^/']+)\//g),
  ];
  await db.photo.deleteMany({});
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
      await db.photo.create({ data: { title: name, imageUrl: resolveImg(p), sortOrder: n } });
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
  await db.track.deleteMany({});
  let n = 0;
  for (const h of heads) {
    // "ソードアート・オンライン（刀剑神域…）" → keep the 日文 head, note the 中文
    const jp = h.replace(/（.*?）|\(.*?\)/g, "").trim();
    await db.track.create({
      data: { title: jp || h, note: h, status: "在听", sortOrder: n },
    });
    n++;
  }
  return n;
}

async function main() {
  console.log("HEXO_SRC =", SRC);
  const posts = await importPosts();
  const friends = await importFriends();
  const moments = await importMoments();
  const movies = await importMovies();
  const photos = await importGallery();
  const tracks = await importMusic();
  console.log(
    `✓ imported: posts=${posts} friends=${friends} moments=${moments} movies=${movies} photos=${photos} tracks=${tracks}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
