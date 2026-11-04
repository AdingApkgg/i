import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { upstreamJson } from "./upstream-json";

/** Bangumi 的游戏条目（subject type 4），只读公开资料 */
const rawSubject = z.object({
  id: z.number().int().positive(),
  type: z.number().int(),
  name: z.string().min(1).max(1000),
  name_cn: z.string().max(1000).optional().default(""),
  summary: z.string().max(20000).nullish(),
  date: z.string().nullish(),
  platform: z.string().max(200).nullish(),
  images: z.object({ large: z.string().optional(), common: z.string().optional() }).nullish(),
  rating: z.object({ score: z.number().finite() }).nullish(),
  infobox: z.array(z.object({ key: z.string().max(60), value: z.unknown() })).default([]),
  tags: z.array(z.object({ name: z.string().min(1).max(120), count: z.number() })).default([]),
});

/** infobox 的 value 可能是字符串、`[{v}]` 或 `[{k,v}]`，统一抽成文本数组 */
function infoValues(raw: z.infer<typeof rawSubject>, key: string): string[] {
  const entry = raw.infobox.find((box) => box.key === key);
  const value = entry?.value;
  const one = (v: unknown) => {
    if (typeof v === "string") return v.trim();
    if (v && typeof v === "object") {
      const record = v as { v?: unknown; k?: unknown };
      if (typeof record.v === "string") return record.v.trim();
    }
    return "";
  };
  const list = Array.isArray(value) ? value.map(one) : [one(value)];
  return list.filter((text) => text.length > 0 && text.length <= 120);
}
export interface BgmNovel {
  bgmId: number;
  title: string;
  originalTitle: string;
  brand: string;
  released: string;
  coverUrl: string;
  bgmRating: number | null;
  descriptionOriginal: string;
  tags: string[];
  platforms: string[];
  link: string;
}

/** 太泛的标签不占位置 */
const TAG_NOISE = new Set(["游戏", "PC", "日本", "Galgame"]);
const TAG_MAX = 10;
const COVER =
  /^https:\/\/lain\.bgm\.tv\/pic\/cover\/[lm]\/[0-9a-f]{2}\/[0-9a-f]{2}\/\d+[^/]*\.(?:jpg|png|webp)$/;

function normalize(raw: z.infer<typeof rawSubject>): BgmNovel {
  const cover = raw.images?.large ?? raw.images?.common ?? "";
  return {
    bgmId: raw.id,
    title: raw.name_cn.trim() || raw.name,
    originalTitle: raw.name,
    brand: infoValues(raw, "开发").slice(0, 2).join(" / "),
    released: raw.date ?? "",
    coverUrl: COVER.test(cover) ? cover : "",
    bgmRating: raw.rating?.score == null ? null : Math.round(raw.rating.score * 10) / 10,
    descriptionOriginal: raw.summary ?? "",
    tags: [...new Set(raw.tags.map((t) => t.name))]
      .filter((name) => !TAG_NOISE.has(name))
      .slice(0, TAG_MAX),
    platforms: (infoValues(raw, "平台").length > 0
      ? infoValues(raw, "平台")
      : raw.platform && raw.platform !== "游戏"
        ? [raw.platform]
        : []
    ).slice(0, 6),
    link: `https://bgm.tv/subject/${raw.id}`,
  };
}

/**
 * 与 VNDB 客户端同样节流、缓存、限流；Bangumi 公开接口 1.2s 一次足够。
 * token 可选，配置后带上以避免匿名限速。
 */
export function createBgmClient(fetcher: typeof fetch = fetch, intervalMs = 1300, token = "") {
  const cache = new Map<string, { expires: number; value: BgmNovel[] }>();
  const pending = new Map<string, Promise<BgmNovel[]>>();
  let tail: Promise<unknown> = Promise.resolve();
  let lastStarted = 0;
  let blockedUntil = 0;
  function send(url: string, init: RequestInit): Promise<Response> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "AdingApkgg/i (https://github.com/AdingApkgg/i)",
    };
    if (token.trim()) headers.Authorization = `Bearer ${token.trim()}`;
    return fetcher(url, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers,
    });
  }
  /** 统一排队：命中 429 就封锁一分钟，避免继续撞限速 */
  function queue(q: string, task: () => Promise<BgmNovel[]>): Promise<BgmNovel[]> {
    const queued = Date.now();
    const run = tail
      .catch(() => {})
      .then(async () => {
        if (Date.now() - queued > 20000 || Date.now() < blockedUntil)
          throw new ORPCError("TOO_MANY_REQUESTS", { message: "Bangumi 请求较多，请稍后重试" });
        const wait = Math.max(0, lastStarted + intervalMs - Date.now());
        if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
        lastStarted = Date.now();
        try {
          return await task();
        } catch (e) {
          if (e instanceof ORPCError) throw e;
          throw new ORPCError("BAD_GATEWAY", { message: "暂时无法获取 Bangumi 资料，请稍后重试" });
        }
      })
      .finally(() => pending.delete(q));
    pending.set(q, run);
    tail = run;
    return run;
  }
  async function read(response: Response, label: string) {
    if (response.status === 429) {
      blockedUntil = Date.now() + 60000;
      await response.body?.cancel();
      throw new ORPCError("TOO_MANY_REQUESTS", { message: "Bangumi 请求较多，请稍候一分钟再试" });
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(label);
    }
    return upstreamJson(response);
  }
  function search(query: string): Promise<BgmNovel[]> {
    const q = query.trim();
    if (!q || q.length > 120) return Promise.reject(new ORPCError("BAD_REQUEST"));
    const cached = cache.get(q);
    if (cached && cached.expires > Date.now()) return Promise.resolve(cached.value);
    const existing = pending.get(q);
    if (existing) return existing;
    if (pending.size >= 8 || Date.now() < blockedUntil)
      return Promise.reject(
        new ORPCError("TOO_MANY_REQUESTS", { message: "Bangumi 请求较多，请稍后重试" }),
      );
    return queue(q, async () => {
      const response = await send("https://api.bgm.tv/v0/search/subjects?limit=8", {
        method: "POST",
        body: JSON.stringify({ keyword: q, filter: { type: [4] } }),
      });
      const parsed = z
        .object({ data: z.array(rawSubject).max(8) })
        .parse(await read(response, "Bangumi failure"));
      const value = parsed.data.map(normalize);
      if (cache.size >= 50) cache.delete(cache.keys().next().value!);
      cache.set(q, { expires: Date.now() + 300000, value });
      return value;
    });
  }
  /** 单条详情：回填脚本按 bgmId 取，返回数组以复用缓存结构 */
  function fetchOne(id: number): Promise<BgmNovel[]> {
    if (!Number.isInteger(id) || id <= 0) return Promise.reject(new ORPCError("BAD_REQUEST"));
    const q = `#${id}`;
    const cached = cache.get(q);
    if (cached && cached.expires > Date.now()) return Promise.resolve(cached.value);
    const existing = pending.get(q);
    if (existing) return existing;
    return queue(q, async () => {
      const response = await send(`https://api.bgm.tv/v0/subjects/${id}`, { method: "GET" });
      const raw = rawSubject.parse(await read(response, "Bangumi failure"));
      const value = [normalize(raw)];
      cache.set(q, { expires: Date.now() + 300000, value });
      return value;
    });
  }
  return { search, fetchOne };
}
export const bgmClient = createBgmClient(fetch, 1300, process.env.BANGUMI_ACCESS_TOKEN ?? "");
