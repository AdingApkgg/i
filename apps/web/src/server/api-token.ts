import { createHash, randomBytes } from "node:crypto";
import { apiToken, db, user } from "@i/db";
import { and, eq, isNull } from "drizzle-orm";

/** 明文前缀，方便在日志/界面里一眼认出是本站 token */
const PREFIX = "i_";
const CACHE_TTL_MS = 30_000;

export type TokenScope = "read" | "write";

export function hashToken(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

/** 新 token：返回明文（只出现这一次）和可入库的行 */
export function mintToken(userId: string, name: string, scope: TokenScope, expiresAt: Date | null) {
  const secret = `${PREFIX}${randomBytes(24).toString("base64url")}`;
  return {
    secret,
    values: {
      name,
      scope,
      userId,
      expiresAt,
      prefix: secret.slice(0, PREFIX.length + 6),
      tokenHash: hashToken(secret),
    },
  };
}

export function parseBearer(header: string | null | undefined) {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) return null;
  const secret = match[1]!;
  return secret.startsWith(PREFIX) ? secret : null;
}

type Resolved = { tokenId: string; scope: TokenScope; user: typeof user.$inferSelect };

const cache = new Map<string, { value: Resolved | null; at: number }>();

/** 吊销/过期立即生效的旁路：管理操作后清掉这条 */
export function forgetToken(secret: string | null) {
  if (!secret) return;
  cache.delete(hashToken(secret));
}

export function clearTokenCache() {
  cache.clear();
}

/**
 * 校验 Bearer token。缓存 30s，命中不查库；lastUsedAt 只在超过 1 分钟时回写，
 * 避免每个请求都产生一次 UPDATE。
 */
export async function verifyToken(secret: string): Promise<Resolved | null> {
  const hash = hashToken(secret);
  const hit = cache.get(hash);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const [row] = await db
    .select({ token: apiToken, owner: user })
    .from(apiToken)
    .innerJoin(user, eq(user.id, apiToken.userId))
    .where(and(eq(apiToken.tokenHash, hash), isNull(apiToken.revokedAt)))
    .limit(1);

  const value =
    row && (!row.token.expiresAt || row.token.expiresAt.getTime() > Date.now())
      ? { tokenId: row.token.id, scope: row.token.scope as TokenScope, user: row.owner }
      : null;

  if (value) {
    const stale = !row!.token.lastUsedAt || Date.now() - row!.token.lastUsedAt.getTime() > 60_000;
    if (stale) {
      void db
        .update(apiToken)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiToken.id, value.tokenId))
        .catch(() => {});
    }
  }

  cache.set(hash, { value, at: Date.now() });
  return value;
}
