import { db } from "@i/db";
import { ORPCError, os } from "@orpc/server";
import { isAdminRole } from "@/lib/roles";
import { identify } from "./identity";

export async function createContext(opts: { headers: Headers }) {
  const who = await identify(opts.headers);
  return {
    db,
    session: who?.session ?? null,
    // Bearer token 优先：它代表一个明确的机器身份，便于只读 token 收窄权限
    user: who?.user ?? null,
    token: who?.tokenId ? { id: who.tokenId, scope: who.scope } : null,
    headers: opts.headers,
  };
}
export type Context = Awaited<ReturnType<typeof createContext>>;

const base = os.$context<Context>();

export const publicProcedure = base;

export const protectedProcedure = base.use(({ context, next }) => {
  if (!context.user) throw new ORPCError("UNAUTHORIZED");
  // Bearer 请求没有 session，保留可空类型免得下游误当非空
  return next({ context: { user: context.user, session: context.session } });
});

export const adminProcedure = base.use(({ context, next }) => {
  if (!context.user) throw new ORPCError("UNAUTHORIZED");
  if (!isAdminRole(context.user)) throw new ORPCError("FORBIDDEN");
  // Bearer 请求没有 session，保留可空类型免得下游误当非空
  return next({ context: { user: context.user, session: context.session } });
});

/**
 * 写操作：admin 之外还要求 token 有 write 权限。
 * cookie 登录（Web 后台）没有 token，等同 write；read token 打过来就是只读。
 */
export const writeProcedure = adminProcedure.use(({ context, next }) => {
  if (context.token?.scope === "read") {
    throw new ORPCError("FORBIDDEN", { message: "这个 API token 是只读的" });
  }
  return next({ context: {} });
});
