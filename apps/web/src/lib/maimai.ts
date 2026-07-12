import "server-only";
import { db } from "@i/db";

/** Normalized record shape stored in MaimaiRecord. */
export interface MappedRecord {
  songId: number;
  title: string;
  type: "standard" | "dx";
  levelIndex: number;
  levelLabel: string;
  ds: number | null;
  achievements: number;
  dxScore: number;
  ra: number;
  fc: string | null;
  fs: string | null;
  rate: string | null;
  coverUrl: string | null;
  pool: "b35" | "b15" | null;
  boardOrder: number;
}

export interface SyncResult {
  source: string;
  nickname: string;
  rating: number;
  count: number;
}

const dfType = (t: string): "standard" | "dx" => (t.toUpperCase() === "DX" ? "dx" : "standard");
const dfCover = (id: number) => `https://www.diving-fish.com/covers/${String(id).padStart(5, "0")}.png`;
const lxnsCover = (id: number) => `https://assets2.lxns.net/maimai/jacket/${id}.png`;

// ---------------- 水鱼 diving-fish ----------------

// biome-ignore lint/suspicious/noExplicitAny: external API payloads
function mapDivingFish(r: any, pool: "b35" | "b15" | null, order: number): MappedRecord {
  return {
    songId: Number(r.song_id),
    title: String(r.title ?? ""),
    type: dfType(String(r.type ?? "SD")),
    levelIndex: Number(r.level_index ?? 0),
    levelLabel: String(r.level ?? ""),
    ds: r.ds != null ? Number(r.ds) : null,
    achievements: Number(r.achievements ?? 0),
    dxScore: Number(r.dxScore ?? 0),
    ra: Number(r.ra ?? 0),
    fc: r.fc || null,
    fs: r.fs || null,
    rate: r.rate || null,
    coverUrl: dfCover(Number(r.song_id)),
    pool,
    boardOrder: order,
  };
}

async function fetchDivingFish(username: string, importToken?: string | null) {
  // b50 — public query, no auth.
  const res = await fetch("https://www.diving-fish.com/api/maimaidxprober/query/player", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, b50: true }),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(`水鱼查询失败：${(msg as { message?: string }).message ?? res.status}`);
  }
  // biome-ignore lint/suspicious/noExplicitAny: external
  const data: any = await res.json();
  const b35: MappedRecord[] = (data.charts?.sd ?? []).map((r: unknown, i: number) => mapDivingFish(r, "b35", i));
  const b15: MappedRecord[] = (data.charts?.dx ?? []).map((r: unknown, i: number) => mapDivingFish(r, "b15", i));

  const byKey = new Map<string, MappedRecord>();
  const put = (rec: MappedRecord) => byKey.set(`${rec.songId}:${rec.type}:${rec.levelIndex}`, rec);

  // Optional: full records via Import-Token (self-service).
  if (importToken) {
    const rr = await fetch("https://www.diving-fish.com/api/maimaidxprober/player/records", {
      headers: { "Import-Token": importToken },
    });
    if (rr.ok) {
      // biome-ignore lint/suspicious/noExplicitAny: external
      const all: any = await rr.json();
      for (const r of all.records ?? []) put(mapDivingFish(r, null, 0));
    }
  }
  for (const r of [...b35, ...b15]) put(r); // b50 overrides pool/order
  return {
    nickname: String(data.nickname ?? username),
    rating: Number(data.rating ?? 0),
    records: [...byKey.values()],
  };
}

// ---------------- 落雪 lxns ----------------

// biome-ignore lint/suspicious/noExplicitAny: external
function mapLxns(r: any, pool: "b35" | "b15" | null, order: number): MappedRecord {
  const type = r.type === "dx" ? "dx" : "standard";
  return {
    songId: Number(r.id) % 10000,
    title: String(r.song_name ?? ""),
    type,
    levelIndex: Number(r.level_index ?? 0),
    levelLabel: String(r.level ?? ""),
    ds: null,
    achievements: Number(r.achievements ?? 0),
    dxScore: Number(r.dx_score ?? 0),
    ra: Math.floor(Number(r.dx_rating ?? 0)),
    fc: r.fc || null,
    fs: r.fs || null,
    rate: r.rate || null,
    coverUrl: lxnsCover(Number(r.id) % 10000),
    pool,
    boardOrder: order,
  };
}

async function lxnsGet(path: string, token: string) {
  const res = await fetch(`https://maimai.lxns.net/api/v0/user/maimai/${path}`, {
    headers: { "X-User-Token": token },
  });
  const body = await res.json().catch(() => ({}));
  // biome-ignore lint/suspicious/noExplicitAny: external
  const b = body as any;
  if (!res.ok || b.success === false) {
    throw new Error(`落雪查询失败：${b.message ?? res.status}`);
  }
  return b.data;
}

async function fetchLxns(token: string) {
  const player = await lxnsGet("player", token);
  const bests = await lxnsGet("player/bests", token).catch(() => null);
  const scores = await lxnsGet("player/scores", token).catch(() => []);

  const byKey = new Map<string, MappedRecord>();
  const put = (rec: MappedRecord) => byKey.set(`${rec.songId}:${rec.type}:${rec.levelIndex}`, rec);

  for (const r of Array.isArray(scores) ? scores : []) {
    if (r.type === "utage") continue;
    put(mapLxns(r, null, 0));
  }
  if (bests) {
    (bests.standard ?? []).forEach((r: unknown, i: number) => put(mapLxns(r, "b35", i)));
    (bests.dx ?? []).forEach((r: unknown, i: number) => put(mapLxns(r, "b15", i)));
  }
  return {
    nickname: String(player?.name ?? "maimai"),
    rating: Number(player?.rating ?? 0),
    records: [...byKey.values()],
  };
}

// ---------------- 同步 ----------------

export async function syncMaimai(): Promise<SyncResult> {
  const cfg = await db.maimaiConfig.findUnique({ where: { id: "current" } });
  if (!cfg) throw new Error("请先在后台配置查分器");
  const source = cfg.source;

  let out: { nickname: string; rating: number; records: MappedRecord[] };
  if (source === "lxns") {
    if (!cfg.lxnsPersonalToken) throw new Error("请填写落雪个人 API 密钥");
    out = await fetchLxns(cfg.lxnsPersonalToken);
  } else {
    if (!cfg.divingFishUsername) throw new Error("请填写水鱼用户名");
    out = await fetchDivingFish(cfg.divingFishUsername, cfg.divingFishImportToken);
  }

  await db.$transaction([
    db.maimaiRecord.deleteMany({}),
    db.maimaiRecord.createMany({
      data: out.records.map((r) => ({ ...r, source })),
    }),
    db.maimaiProfile.upsert({
      where: { id: "current" },
      update: { source, nickname: out.nickname, rating: out.rating },
      create: { id: "current", source, nickname: out.nickname, rating: out.rating },
    }),
  ]);

  return { source, nickname: out.nickname, rating: out.rating, count: out.records.length };
}
