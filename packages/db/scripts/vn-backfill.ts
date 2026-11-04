/**
 * 视觉小说元数据回填（VNDB / Bangumi → Vn 表）。
 *
 *   DATABASE_URL=… bun packages/db/scripts/vn-backfill.ts                  # 只出候选
 *   DATABASE_URL=… bun packages/db/scripts/vn-backfill.ts --out c.json     # 指定候选文件
 *   DATABASE_URL=… bun packages/db/scripts/vn-backfill.ts --apply c.json   # 按确认表写入
 *   … --apply c.json --force                                               # 覆盖已有非空值
 *
 * 候选文件每项：{ id, title, picks: [{ source, remoteId, title, score }] }。
 * 人工把想采用的那个改成 match: { source, remoteId } 后加 --apply 才写库。
 * 默认只填空白字段，已有值不动（--force 才覆盖）。
 */

import { readFile, writeFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { Client } from "pg";

const UA = "AdingApkgg/i (https://github.com/AdingApkgg/i)";
const args = process.argv.slice(2);
const APPLY_INDEX = args.indexOf("--apply");
const APPLY_FILE = APPLY_INDEX >= 0 ? args[APPLY_INDEX + 1] : undefined;
const OUT_INDEX = args.indexOf("--out");
const OUT_FILE =
  OUT_INDEX >= 0
    ? (args[OUT_INDEX + 1] ?? "vn-backfill-candidates.json")
    : "vn-backfill-candidates.json";
const FORCE = args.includes("--force");

interface Pick {
  source: "vndb" | "bgm";
  remoteId: string;
  title: string;
  originalTitle: string;
  score: number;
}

/** 只留中日英文字与数字，便于跨站比对标题 */
const norm = (s: string) => s.toLowerCase().replace(/[\s\-–—_/·:：!！?？'"“”‘’()（）[\]【】]/g, "");

function similarity(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.85;
  // 二元组重合度，够判断「同一作」即可
  const grams = (s: string) =>
    new Set([...s].map((_, i) => s.slice(i, i + 2)).filter((g) => g.length === 2));
  const ga = grams(x);
  const gb = grams(y);
  if (ga.size === 0 || gb.size === 0) return 0;
  let hit = 0;
  for (const g of ga) if (gb.has(g)) hit++;
  return (2 * hit) / (ga.size + gb.size);
}

async function getJson(url: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(url, {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(20000),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": UA,
      ...(process.env.BANGUMI_ACCESS_TOKEN && url.includes("bgm.tv")
        ? { Authorization: `Bearer ${process.env.BANGUMI_ACCESS_TOKEN}` }
        : {}),
    },
  });
  if (response.status === 429) {
    await delay(65000);
    return getJson(url, init);
  }
  if (!response.ok) throw new Error(`${url} → ${response.status}`);
  return response.json();
}

type VndbRaw = {
  id: string;
  title: string;
  description: string | null;
  released: string | null;
  rating: number | null;
  length_minutes: number | null;
  image: { url: string; sexual: number; violence: number } | null;
  developers: { name: string }[];
  platforms: string[];
  tags: { name: string; rating: number | null; spoiler: number | null; category: string | null }[];
};
async function searchVndb(title: string): Promise<VndbRaw[]> {
  const body = JSON.stringify({
    filters: /^v[1-9]\d*$/.test(title) ? ["id", "=", title] : ["search", "=", title],
    fields:
      "title,description,released,rating,length_minutes,image{url,sexual,violence},developers.name,platforms,tags{name,rating,spoiler,category}",
    results: 3,
  });
  const data = (await getJson("https://api.vndb.org/kana/vn", { method: "POST", body })) as {
    results: VndbRaw[];
  };
  return data.results;
}

type BgmRaw = {
  id: number;
  name: string;
  name_cn: string;
  summary: string | null;
  date: string | null;
  rating: { score: number } | null;
  images: { large?: string; common?: string } | null;
  platform: string | null;
  infobox: { key: string; value: unknown }[];
  tags: { name: string }[];
};
async function searchBgm(title: string): Promise<BgmRaw[]> {
  const body = JSON.stringify({ keyword: title, filter: { type: [4] } });
  const data = (await getJson("https://api.bgm.tv/v0/search/subjects?limit=3", {
    method: "POST",
    body,
  })) as { data: BgmRaw[] };
  return data.data;
}

function infoValues(raw: BgmRaw, key: string): string[] {
  const entry = raw.infobox.find((box) => box.key === key);
  const one = (v: unknown) =>
    typeof v === "string"
      ? v.trim()
      : v && typeof v === "object" && typeof (v as { v?: unknown }).v === "string"
        ? (v as { v: string }).v.trim()
        : "";
  const list = Array.isArray(entry?.value) ? entry.value.map(one) : [one(entry?.value)];
  return list.filter(Boolean);
}

const COVER_VNDB = /^https:\/\/t\.vndb\.org\/cv\/\d+\/\d+\.(?:jpg|png|webp)$/;
const COVER_BGM =
  /^https:\/\/lain\.bgm\.tv\/pic\/cover\/[lm]\/[0-9a-f]{2}\/[0-9a-f]{2}\/\d+[^/]*\.(?:jpg|png|webp)$/;
/** VNDB 平台代码 → 展示名（与 apps/web/src/server/vndb.ts 的 PLATFORM_LABEL 一致） */
const PLATFORM_LABEL: Record<string, string> = {
  win: "Windows",
  lin: "Linux",
  mac: "macOS",
  ios: "iOS",
  and: "Android",
  web: "Web",
  nds: "NDS",
  psp: "PSP",
  ps1: "PS1",
  ps2: "PS2",
  ps3: "PS3",
  ps4: "PS4",
  psv: "PSV",
  swi: "Switch",
  bdp: "BD Player",
};
const TAG_NOISE = new Set(["游戏", "PC", "日本", "Galgame"]);

/** 一条候选抓成可写字段 */
async function resolve(source: "vndb" | "bgm", remoteId: string) {
  if (source === "vndb") {
    const raw = (await searchVndb(remoteId))[0];
    if (!raw) return null;
    return {
      vndbId: raw.id,
      title: raw.title,
      brand: raw.developers.map((d) => d.name).join(" / "),
      released: raw.released ?? "",
      vndbRating: raw.rating == null ? null : Math.round(raw.rating * 10) / 100,
      coverUrl:
        raw.image &&
        raw.image.sexual < 0.5 &&
        raw.image.violence < 0.5 &&
        COVER_VNDB.test(raw.image.url)
          ? raw.image.url
          : "",
      descriptionOriginal: raw.description ?? "",
      lengthMinutes: raw.length_minutes,
      tags: raw.tags
        .filter((t) => (t.rating ?? 0) >= 2 && (t.spoiler ?? 0) <= 1 && t.category !== "tech")
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
        .slice(0, 10)
        .map((t) => t.name),
      platforms: [...new Set(raw.platforms)]
        .map((p) => PLATFORM_LABEL[p] ?? p.toUpperCase())
        .slice(0, 6),
      link: `https://vndb.org/${raw.id}`,
      bgmId: null as number | null,
    };
  }
  const raw = (await getJson(`https://api.bgm.tv/v0/subjects/${remoteId}`, {
    method: "GET",
  })) as BgmRaw;
  const cover = raw.images?.large ?? raw.images?.common ?? "";
  return {
    vndbId: null as string | null,
    title: raw.name_cn || raw.name,
    brand: infoValues(raw, "开发").slice(0, 2).join(" / "),
    released: raw.date ?? "",
    vndbRating: null as number | null,
    coverUrl: COVER_BGM.test(cover) ? cover : "",
    descriptionOriginal: raw.summary ?? "",
    lengthMinutes: null as number | null,
    tags: [...new Set(raw.tags.map((t) => t.name))].filter((n) => !TAG_NOISE.has(n)).slice(0, 10),
    platforms: infoValues(raw, "平台").slice(0, 6),
    link: `https://bgm.tv/subject/${raw.id}`,
    bgmId: raw.id,
  };
}

/** 搜索用的标题变体：原标题、去副标题的主体、主体去卷号（系列作靠主体才搜得到） */
function queries(title: string) {
  const base = title
    .replace(/\s*[-–—]\s*[^-–—]+[-–—]\s*$/, "")
    .replace(/\d+$/, "")
    .trim();
  return [...new Set([title, base, title.replace(/\d+$/, "").trim()].filter(Boolean))];
}

async function candidates(client: Client) {
  const { rows } = await client.query<{ id: string; title: string }>(
    'select id, title from "Vn" order by "createdAt"',
  );
  const out: { id: string; title: string; picks: Pick[] }[] = [];
  for (const row of rows) {
    const seen = new Set<string>();
    const picks: Pick[] = [];
    for (const query of queries(row.title)) {
      try {
        for (const raw of await searchVndb(query)) {
          if (seen.has(`vndb:${raw.id}`)) continue;
          seen.add(`vndb:${raw.id}`);
          picks.push({
            source: "vndb",
            remoteId: raw.id,
            title: raw.title,
            originalTitle: raw.title,
            score: similarity(row.title, raw.title),
          });
        }
      } catch (e) {
        console.error(`VNDB ${query}: ${(e as Error).message}`);
      }
      await delay(1500);
      try {
        for (const raw of await searchBgm(query)) {
          const label = raw.name_cn || raw.name;
          if (seen.has(`bgm:${raw.id}`)) continue;
          seen.add(`bgm:${raw.id}`);
          picks.push({
            source: "bgm",
            remoteId: String(raw.id),
            title: label,
            originalTitle: raw.name,
            score: Math.max(similarity(row.title, raw.name), similarity(row.title, label)),
          });
        }
      } catch (e) {
        console.error(`BGM ${query}: ${(e as Error).message}`);
      }
      await delay(1500);
    }
    picks.sort((a, b) => b.score - a.score);
    out.push({ id: row.id, title: row.title, picks: picks.slice(0, 6) });
    console.error(
      `${row.title} → ${picks[0]?.title ?? "无候选"} (${picks[0]?.score.toFixed(2) ?? "-"})`,
    );
  }
  return out;
}

async function applyMap(client: Client, file: string) {
  const list = JSON.parse(await readFile(file, "utf8")) as {
    id: string;
    title: string;
    match?: { source: "vndb" | "bgm"; remoteId: string };
    picks?: Pick[];
  }[];
  const chosen = list.filter((item) => item.match);
  console.log(`确认映射 ${chosen.length} / ${list.length} 条`);
  let changed = 0;
  await client.query("BEGIN");
  try {
    for (const item of chosen) {
      const data = await resolve(item.match!.source, item.match!.remoteId);
      if (!data) {
        console.warn(`跳过 ${item.title}：远端条目取不到`);
        continue;
      }
      const { rows } = await client.query<Record<string, unknown>>(
        'select * from "Vn" where id = $1',
        [item.id],
      );
      const current = rows[0];
      if (!current) {
        console.warn(`跳过 ${item.title}：库中已无该记录`);
        continue;
      }
      const sets: string[] = [];
      const values: unknown[] = [];
      for (const [column, value] of Object.entries(data)) {
        if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) continue;
        const before = current[column];
        const empty =
          before == null || before === "" || (Array.isArray(before) && before.length === 0);
        if (!FORCE && !empty) continue;
        sets.push(`"${column}" = $${values.length + 2}`);
        values.push(value);
      }
      const put = (column: string, value: unknown) => {
        sets.push(`"${column}" = $${values.length + 2}`);
        values.push(value);
      };
      if (sets.length === 0) continue;
      put("updatedAt", new Date());
      await client.query(`update "Vn" set ${sets.join(", ")} where id = $1`, [item.id, ...values]);
      changed++;
      console.log(`已更新 ${item.title}`);
      await delay(1500);
    }
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  }
  await client.query("COMMIT");
  console.log(`写入 ${changed} 条`);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  if (APPLY_FILE) {
    await applyMap(client, APPLY_FILE);
  } else {
    const list = await candidates(client);
    await writeFile(OUT_FILE, `${JSON.stringify(list, null, 2)}\n`);
    console.log(`候选已写入 ${OUT_FILE}：补上 match 后加 --apply 执行`);
  }
} finally {
  await client.end();
}
