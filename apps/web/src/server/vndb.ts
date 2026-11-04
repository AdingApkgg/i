import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { upstreamJson } from "./upstream-json";

const rawTag = z.object({
  id: z.string(),
  name: z.string().min(1).max(120),
  rating: z.number().nullish(),
  spoiler: z.number().nullish(),
  category: z.enum(["cont", "ero", "tech"]).nullish(),
});
const rawNovel = z.object({
  id: z.string().regex(/^v[1-9]\d*$/),
  title: z.string().min(1).max(1000),
  titles: z
    .array(z.object({ lang: z.string(), title: z.string(), official: z.boolean() }))
    .default([]),
  description: z.string().max(20000).nullish(),
  released: z.string().nullish(),
  developers: z.array(z.object({ name: z.string() })).default([]),
  rating: z.number().min(0).max(100).nullish(),
  length_minutes: z.number().int().nonnegative().nullish(),
  platforms: z.array(z.string()).default([]),
  tags: z.array(rawTag).default([]),
  image: z.object({ url: z.string(), sexual: z.number(), violence: z.number() }).nullish(),
});
export interface VndbNovel {
  vndbId: string;
  title: string;
  originalTitle: string;
  brand: string;
  released: string;
  coverUrl: string;
  vndbRating: number | null;
  descriptionOriginal: string;
  lengthMinutes: number | null;
  tags: string[];
  platforms: string[];
  link: string;
}

/** 只保留有共识（抽样评分 ≥2）且不剧透的标签，内容/成人分类都收，技术标签不要 */
const TAG_MIN_RATING = 2;
const TAG_MAX = 10;
function pickTags(tags: z.infer<typeof rawTag>[]) {
  return tags
    .filter(
      (t) =>
        (t.rating ?? 0) >= TAG_MIN_RATING &&
        (t.spoiler ?? 0) <= 1 &&
        (t.category ?? "cont") !== "tech",
    )
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, TAG_MAX)
    .map((t) => t.name);
}

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
  ps5: "PS5",
  psv: "PS Vita",
  xb1: "Xbox One",
  xbo: "Xbox",
  xb3: "Xbox 360",
  sfc: "SFC",
  gba: "GBA",
  dos: "DOS",
  bdp: "蓝光播放机",
};
function pickPlatforms(platforms: string[]) {
  return [...new Set(platforms)].map((p) => PLATFORM_LABEL[p] ?? p.toUpperCase()).slice(0, 6);
}

function normalize(raw: z.infer<typeof rawNovel>): VndbNovel {
  const image = raw.image;
  const chinese =
    raw.titles.find((t) => t.lang === "zh-Hans" && t.official) ??
    raw.titles.find((t) => t.lang === "zh-Hans");
  return {
    vndbId: raw.id,
    title: chinese?.title ?? raw.title,
    originalTitle: raw.title,
    brand: raw.developers.map((d) => d.name).join(" / "),
    released: raw.released ?? "",
    vndbRating: raw.rating == null ? null : Math.round(raw.rating * 10) / 100,
    coverUrl:
      image &&
      image.sexual < 0.5 &&
      image.violence < 0.5 &&
      /^https:\/\/t\.vndb\.org\/cv\/\d+\/\d+\.(?:jpg|png|webp)$/.test(image.url)
        ? image.url
        : "",
    // 原文逐字保留；前端按文本渲染，绝不注入 HTML。
    descriptionOriginal: raw.description ?? "",
    lengthMinutes: raw.length_minutes ?? null,
    tags: pickTags(raw.tags),
    platforms: pickPlatforms(raw.platforms),
    link: `https://vndb.org/${raw.id}`,
  };
}

/** One paced, bounded queue per application process; successful public data only. */
export function createVndbClient(fetcher: typeof fetch = fetch, intervalMs = 1600) {
  const cache = new Map<string, { expires: number; value: VndbNovel[] }>();
  const pending = new Map<string, Promise<VndbNovel[]>>();
  let tail: Promise<unknown> = Promise.resolve();
  let lastStarted = 0;
  let blockedUntil = 0;
  return function search(query: string): Promise<VndbNovel[]> {
    const q = query.trim();
    if (!q || q.length > 120) return Promise.reject(new ORPCError("BAD_REQUEST"));
    const cached = cache.get(q);
    if (cached && cached.expires > Date.now()) return Promise.resolve(cached.value);
    const existing = pending.get(q);
    if (existing) return existing;
    if (pending.size >= 8 || Date.now() < blockedUntil)
      return Promise.reject(
        new ORPCError("TOO_MANY_REQUESTS", { message: "VNDB 请求较多，请稍后重试" }),
      );
    const queued = Date.now();
    const run = tail
      .catch(() => {})
      .then(async () => {
        if (Date.now() - queued > 20000 || Date.now() < blockedUntil)
          throw new ORPCError("TOO_MANY_REQUESTS", { message: "VNDB 请求较多，请稍后重试" });
        const wait = Math.max(0, lastStarted + intervalMs - Date.now());
        if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
        lastStarted = Date.now();
        try {
          const response = await fetcher("https://api.vndb.org/kana/vn", {
            method: "POST",
            redirect: "error",
            signal: AbortSignal.timeout(15000),
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "AdingApkgg/i (https://github.com/AdingApkgg/i)",
            },
            body: JSON.stringify({
              filters: /^v[1-9]\d*$/.test(q) ? ["id", "=", q] : ["search", "=", q],
              fields:
                "title,titles{lang,title,official},description,released,developers.name,image{url,sexual,violence},rating,length_minutes,platforms,tags{id,name,rating,spoiler,category}",
              results: 8,
            }),
          });
          if (response.status === 429) {
            blockedUntil = Date.now() + 60000;
            await response.body?.cancel();
            throw new ORPCError("TOO_MANY_REQUESTS", {
              message: "VNDB 请求较多，请稍候一分钟再试",
            });
          }
          if (!response.ok) {
            await response.body?.cancel();
            throw new Error("VNDB failure");
          }
          const parsed = z
            .object({ results: z.array(rawNovel).max(8) })
            .parse(await upstreamJson(response));
          const value = parsed.results.map(normalize);
          if (cache.size >= 50) cache.delete(cache.keys().next().value!);
          cache.set(q, { expires: Date.now() + 300000, value });
          return value;
        } catch (e) {
          if (e instanceof ORPCError) throw e;
          throw new ORPCError("BAD_GATEWAY", { message: "暂时无法获取 VNDB 资料，请稍后重试" });
        }
      })
      .finally(() => pending.delete(q));
    pending.set(q, run);
    tail = run;
    return run;
  };
}
export const searchVndb = createVndbClient();
