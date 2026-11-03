/**
 * API token 管理（给 AI / 脚本用）。只有 admin 能进；明文只在 create 的响应里出现一次。
 * 只读 token 打写操作会被 writeProcedure 拦下，这里再提供 scope 选择。
 */
import { apiToken } from "@i/db";
import { ORPCError } from "@orpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { clearTokenCache, mintToken, type TokenScope } from "../api-token";
import { adminProcedure } from "../orpc";

const NAME_MAX = 60;
const TOKEN_LIMIT = 20;

const createSchema = z.object({
  name: z.string().trim().min(1).max(NAME_MAX),
  scope: z.enum(["read", "write"]).default("read"),
  /** 有效天数，留空=不过期 */
  expiresInDays: z.number().int().min(1).max(3650).optional(),
});

/** 明文只在创建时给一次，列表里只留前缀 */
const listColumns = {
  id: apiToken.id,
  name: apiToken.name,
  prefix: apiToken.prefix,
  scope: apiToken.scope,
  lastUsedAt: apiToken.lastUsedAt,
  expiresAt: apiToken.expiresAt,
  revokedAt: apiToken.revokedAt,
  createdAt: apiToken.createdAt,
};

export const apiTokenRouter = {
  list: adminProcedure.handler(async ({ context }) => {
    const rows = await context.db
      .select(listColumns)
      .from(apiToken)
      .orderBy(desc(apiToken.createdAt));
    const active = rows.filter((r) => !r.revokedAt);
    return { items: rows, activeCount: active.length, limit: TOKEN_LIMIT };
  }),

  create: adminProcedure.input(createSchema).handler(async ({ context, input }) => {
    const activeCount = await context.db.$count(apiToken, isNull(apiToken.revokedAt));
    if (activeCount >= TOKEN_LIMIT) {
      throw new ORPCError("BAD_REQUEST", {
        message: `最多同时保留 ${TOKEN_LIMIT} 个有效 token，先撤销不用的`,
      });
    }

    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 86_400_000)
      : null;
    const { secret, values } = mintToken(
      context.user.id,
      input.name,
      input.scope as TokenScope,
      expiresAt,
    );
    const [row] = await context.db.insert(apiToken).values(values).returning(listColumns);
    clearTokenCache();
    return { secret, token: row! };
  }),

  /** 吊销：保留行，便于事后看「这个 token 什么时候用过」 */
  revoke: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const [row] = await context.db
        .update(apiToken)
        .set({ revokedAt: new Date() })
        .where(and(eq(apiToken.id, input.id), isNull(apiToken.revokedAt)))
        .returning(listColumns);
      if (!row) throw new ORPCError("NOT_FOUND", { message: "token 不存在或已撤销" });
      clearTokenCache();
      return row;
    }),

  /** 彻底删掉已撤销的行 */
  delete: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const [row] = await context.db.delete(apiToken).where(eq(apiToken.id, input.id)).returning();
      if (!row) throw new ORPCError("NOT_FOUND", { message: "token 不存在" });
      clearTokenCache();
      return { id: row.id };
    }),
};
