import { db } from "@i/db";
import { ORPCError, os } from "@orpc/server";
import { auth } from "@/lib/auth";

export async function createContext(opts: { headers: Headers }) {
  const session = await auth.api.getSession({ headers: opts.headers }).catch(() => null);
  return {
    db,
    session,
    user: session?.user ?? null,
    headers: opts.headers,
  };
}
export type Context = Awaited<ReturnType<typeof createContext>>;

const base = os.$context<Context>();

export const publicProcedure = base;

export const protectedProcedure = base.use(({ context, next }) => {
  if (!context.user) throw new ORPCError("UNAUTHORIZED");
  return next({ context: { user: context.user, session: context.session! } });
});

export const adminProcedure = base.use(({ context, next }) => {
  if (!context.user) throw new ORPCError("UNAUTHORIZED");
  const role = (context.user as { role?: string }).role;
  if (role !== "admin" && role !== "owner") {
    throw new ORPCError("FORBIDDEN");
  }
  return next({ context: { user: context.user, session: context.session! } });
});
