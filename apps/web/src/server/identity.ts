import { auth } from "@/lib/auth";
import { parseBearer, type TokenScope, verifyToken } from "./api-token";

export type Identity = {
  // 形状要能同时接住 session 用户和 verifyToken 查出来的行，下游会读 image
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    role?: string | null;
  };
  scope: TokenScope;
  tokenId?: string;
  session: Awaited<ReturnType<typeof auth.api.getSession>>;
};

/**
 * 请求身份：Bearer token 优先，其次 better-auth session。
 * session 走后台浏览器，等同 write；token 的 scope 决定能不能写。
 */
export async function identify(headers: Headers): Promise<Identity | null> {
  const bearer = parseBearer(headers.get("authorization"));
  if (bearer) {
    const token = await verifyToken(bearer).catch(() => null);
    if (token)
      return { user: token.user, scope: token.scope, tokenId: token.tokenId, session: null };
  }
  const session = await auth.api.getSession({ headers }).catch(() => null);
  const user = session?.user;
  return user ? { user, scope: "write", session } : null;
}
