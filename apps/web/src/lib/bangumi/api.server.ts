import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import type { AnimeMetadata, CollectionState, RemoteEntry } from "./types";

const positive = z.number().int().positive();
const collection = z.object({
  subject_id: positive,
  subject_type: z.literal(2),
  type: z.number().int().min(1).max(5),
  rate: z.number().int().min(0).max(10),
  comment: z.string().nullish(),
  private: z.boolean(),
});
const episode = z.object({
  id: positive,
  sort: z.number(),
  name: z.string(),
  name_cn: z.string().optional(),
  type: z.number().int(),
});
const pageSchema = z.object({
  total: z.number().int().min(0).max(100000),
  offset: z.number().int().min(0),
  limit: positive,
  data: z.array(z.unknown()),
});
const subjectSchema = z.object({
  id: positive,
  type: z.literal(2),
  name: z.string(),
  name_cn: z.string(),
  images: z.object({ common: z.string().optional(), medium: z.string().optional() }).optional(),
  date: z.string().nullish(),
  eps: z.number().int().nonnegative(),
  rating: z.object({ score: z.number().finite() }).optional(),
});
export class BangumiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "BangumiError";
  }
}
interface Options {
  fetch?: typeof fetch;
  wait?: (ms: number) => Promise<void>;
  signal?: AbortSignal;
}

/** 目标源固定，凭据不会被发送到客户端提供的 URL。 */
export class BangumiClient {
  private fetcher: typeof fetch;
  private wait: (ms: number) => Promise<void>;
  private identity: Promise<{ id: number; username: string; nickname?: string }> | undefined;
  private signal: AbortSignal;
  private metadataCache = new Map<number, Promise<AnimeMetadata>>();
  constructor(
    private token: string,
    options: Options = {},
  ) {
    if (!token.trim()) throw new BangumiError("请在服务端配置 BANGUMI_ACCESS_TOKEN");
    this.fetcher = options.fetch ?? fetch;
    this.signal = options.signal ?? AbortSignal.timeout(15 * 60 * 1000);
    this.wait =
      options.wait ??
      (async (ms) => {
        await delay(ms, undefined, { signal: this.signal });
      });
  }
  private async request(
    path: string,
    method = "GET",
    body?: unknown,
    missing = false,
  ): Promise<unknown> {
    for (let attempt = 0; attempt < 3; attempt++) {
      this.signal.throwIfAborted();
      if (attempt === 0) await this.wait(250);
      let response: Response;
      try {
        response = await this.fetcher(`https://api.bgm.tv${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${this.token}`,
            "User-Agent": "AdingApkgg/i BangumiSync/1.0 (https://github.com/AdingApkgg/i)",
            ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: AbortSignal.any([this.signal, AbortSignal.timeout(10000)]),
          redirect: "error",
        });
      } catch {
        if (attempt < 2 && !this.signal.aborted) {
          await this.wait(1000 * 2 ** attempt);
          continue;
        }
        throw new BangumiError("Bangumi 请求超时或网络异常，请稍后重试");
      }
      if (missing && response.status === 404) return null;
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        const retry = response.headers.get("retry-after");
        const ms =
          retry === null
            ? 1000 * 2 ** attempt
            : /^\d+$/.test(retry)
              ? Number(retry) * 1000
              : Math.max(0, Date.parse(retry) - Date.now());
        if (Number.isFinite(ms) && ms <= 30000) {
          await this.wait(ms);
          continue;
        }
      }
      if (!response.ok)
        throw new BangumiError(
          `Bangumi ${method} 失败（HTTP ${response.status}）${response.status === 401 || response.status === 403 ? "，请检查 token 与 write:collection 权限" : ""}`,
          response.status,
        );
      if (response.status === 204) return null;
      try {
        return await response.json();
      } catch {
        throw new BangumiError("Bangumi 返回了无法解析的数据");
      }
    }
    throw new BangumiError("Bangumi 请求失败");
  }
  private async pages(path: string): Promise<unknown[]> {
    const rows: unknown[] = [];
    let total: number | undefined;
    for (;;) {
      const value = pageSchema.safeParse(
        await this.request(
          `${path}${path.includes("?") ? "&" : "?"}limit=100&offset=${rows.length}`,
        ),
      );
      if (!value.success) throw new BangumiError("Bangumi 分页数据格式异常，请重新演练");
      const p = value.data;
      if (
        p.offset !== rows.length ||
        (total !== undefined && p.total !== total) ||
        p.data.length > p.total - rows.length ||
        (!p.data.length && rows.length < p.total)
      )
        throw new BangumiError("Bangumi 收藏在扫描期间变化或分页不完整，请重新演练");
      total = p.total;
      rows.push(...p.data);
      if (rows.length === total) return rows;
    }
  }
  me() {
    this.identity ??= this.request("/v0/me").then((data) => {
      const result = z
        .object({ id: positive, username: z.string().min(1), nickname: z.string().optional() })
        .safeParse(data);
      if (!result.success) throw new BangumiError("Bangumi 账号信息格式异常");
      return result.data;
    });
    return this.identity;
  }
  subject(id: number): Promise<AnimeMetadata> {
    let pending = this.metadataCache.get(id);
    if (!pending) {
      pending = this.readSubject(id);
      this.metadataCache.set(id, pending);
    }
    return pending;
  }
  private async readSubject(id: number): Promise<AnimeMetadata> {
    const parsed = subjectSchema.safeParse(await this.request(`/v0/subjects/${id}`));
    if (!parsed.success || parsed.data.id !== id)
      throw new BangumiError("该条目不是可读取的动画，或资料格式异常");
    const s = parsed.data;
    const raw = await this.pages(`/v0/episodes?subject_id=${id}`);
    const episodes = raw.map((row) => {
      const e = episode.safeParse(row);
      if (!e.success) throw new BangumiError("Bangumi 章节资料格式异常");
      return {
        id: e.data.id,
        sort: e.data.sort,
        name: e.data.name_cn || e.data.name,
        type: e.data.type,
      };
    });
    if (new Set(episodes.map((e) => e.id)).size !== episodes.length)
      throw new BangumiError("Bangumi 章节重复，请重新演练");
    return {
      id,
      name: s.name,
      nameCn: s.name_cn,
      image: s.images?.common ?? s.images?.medium ?? "",
      date: s.date ?? "",
      eps: s.eps,
      score: s.rating?.score ?? null,
      episodes,
    };
  }
  private async fromCollection(raw: unknown): Promise<RemoteEntry> {
    const parsed = collection.safeParse(raw);
    if (!parsed.success) throw new BangumiError("Bangumi 收藏资料格式异常");
    const c = parsed.data,
      metadata = structuredClone(await this.subject(c.subject_id));
    const states = await this.pages(`/v0/users/-/collections/${c.subject_id}/episodes`);
    const episodes: Record<string, number> = Object.fromEntries(
      metadata.episodes.map((e) => [e.id, 0]),
    );
    const seen = new Set<number>();
    for (const rawState of states) {
      const parsedState = z
        .object({ type: z.number().int().min(0).max(3), episode })
        .safeParse(rawState);
      if (!parsedState.success || seen.has(parsedState.data.episode.id))
        throw new BangumiError("Bangumi 章节状态格式异常或重复");
      const { type, episode: e } = parsedState.data;
      seen.add(e.id);
      episodes[e.id] = type;
      if (!metadata.episodes.some((item) => item.id === e.id))
        metadata.episodes.push({ id: e.id, sort: e.sort, name: e.name_cn || e.name, type: e.type });
    }
    return {
      subjectId: c.subject_id,
      metadata,
      state: { type: c.type, rate: c.rate, comment: c.comment ?? "", private: c.private, episodes },
    };
  }
  async snapshot(
    onProgress?: (done: number, total: number) => Promise<void>,
  ): Promise<RemoteEntry[]> {
    const who = await this.me(),
      raw = await this.pages(
        `/v0/users/${encodeURIComponent(who.username)}/collections?subject_type=2`,
      );
    const parsed = raw.map((row) => collection.safeParse(row));
    if (parsed.some((row) => !row.success)) throw new BangumiError("Bangumi 收藏列表格式异常");
    const ids = parsed.map((row) => (row.success ? row.data.subject_id : 0));
    if (new Set(ids).size !== ids.length) throw new BangumiError("Bangumi 收藏重复，请重新演练");
    const result: RemoteEntry[] = new Array(raw.length);
    let cursor = 0,
      done = 0;
    await onProgress?.(0, raw.length);
    // 四个只读扫描链有界并发；写入仍逐条串行，429 按上游提示退避。
    await Promise.all(
      Array.from({ length: Math.min(4, raw.length) }, async () => {
        while (cursor < raw.length) {
          const index = cursor++;
          result[index] = await this.fromCollection(raw[index]);
          await onProgress?.(++done, raw.length);
        }
      }),
    );
    return result;
  }
  async entry(id: number): Promise<RemoteEntry | null> {
    const who = await this.me();
    const raw = await this.request(
      `/v0/users/${encodeURIComponent(who.username)}/collections/${id}`,
      "GET",
      undefined,
      true,
    );
    if (raw === null) return null;
    const result = await this.fromCollection(raw);
    if (result.subjectId !== id) throw new BangumiError("Bangumi 返回了不匹配的收藏");
    return result;
  }
  async write(id: number, current: CollectionState | null, target: CollectionState): Promise<void> {
    const fields: Record<string, unknown> = {};
    for (const key of ["type", "rate", "comment", "private"] as const)
      if (!current || target[key] !== current[key]) fields[key] = target[key];
    if (Object.keys(fields).length)
      await this.request(`/v0/users/-/collections/${id}`, current ? "PATCH" : "POST", fields);
    // 修改整部状态可能连带改变章节，必须读回后逐集落实明确选择。
    const actual = Object.keys(fields).length ? (await this.entry(id))?.state : current;
    if (!actual) throw new BangumiError("写入后未能读取收藏，请重新演练");
    for (const type of [0, 1, 2, 3]) {
      const ids = Object.entries(target.episodes)
        .filter(([key, value]) => value === type && (actual.episodes[key] ?? 0) !== value)
        .map(([key]) => Number(key));
      for (let start = 0; start < ids.length; start += 100)
        await this.request(`/v0/users/-/collections/${id}/episodes`, "PATCH", {
          episode_id: ids.slice(start, start + 100),
          type,
        });
    }
  }
}
