import { friend, KEYS, redis } from "@i/db";
import { ORPCError } from "@orpc/server";
import { asc, desc, eq, inArray, max } from "drizzle-orm";
import { z } from "zod";
import { notifyApplicantReviewResult, notifyOwnerFriendApply } from "@/lib/mailer";
import { FRIEND_STATUSES, friendApplySchema, friendWriteSchema } from "@/lib/schemas";
import { notFound } from "../crud";
import { checkFriend, runFriendChecks } from "../friend-check";
import { adminProcedure, publicProcedure } from "../orpc";

/**
 * MX Space 式友链：
 *  - list        公开，只返回 active/outdate + 展示字段（email/message 不外泄）
 *  - submit      公开自助申请（匿名带邮箱，或登录沿用账号信息），限流 + URL 去重
 *  - adminList   后台全量
 *  - review      审核通过/拒绝，邮件通知申请人，通过后立即跑一次检测
 *  - check       手动触发存活/反链检测（单条或全量）
 *  - create/update/delete 后台直接维护
 */

const APPLY_LIMIT_PER_HOUR = 3;

const publicColumns = {
  id: friend.id,
  name: friend.name,
  url: friend.url,
  avatarUrl: friend.avatarUrl,
  description: friend.description,
  group: friend.group,
  status: friend.status,
  sortOrder: friend.sortOrder,
};

const byOrder = [asc(friend.sortOrder), desc(friend.createdAt)];
const listed = inArray(friend.status, ["active", "outdate"]);

/** host+path, lowercased, no trailing slash — good enough to dedupe applications. */
function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return null;
  }
}

function clientIp(headers: Headers): string {
  // 信任链：Cloudflare 的 CF-Connecting-IP → nginx 覆写的 X-Real-IP →
  // XFF 最后一跳（由本机 nginx 追加）。首跳是客户端自报的，可伪造，不能用。
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",");
    return hops[hops.length - 1]?.trim() || "unknown";
  }
  return "unknown";
}

// update 专用：不能直接 friendWriteSchema.partial() —— zod 的 .partial() 不会摘掉
// .default()，缺省字段会被重新注入 status:"active"/sortOrder:0，把待审核或
// 已拒绝的行悄悄发布出去。这里把带默认值的字段换成真 optional。
const updateSchema = friendWriteSchema
  .omit({ status: true, sortOrder: true })
  .partial()
  .extend({
    id: z.string().min(1),
    status: z.enum(FRIEND_STATUSES).optional(),
    sortOrder: z.number().int().optional(),
  });

export const friendsRouter = {
  list: publicProcedure.handler(({ context }) =>
    context.db
      .select(publicColumns)
      .from(friend)
      .where(listed)
      .orderBy(...byOrder),
  ),

  submit: publicProcedure.input(friendApplySchema).handler(async ({ context, input }) => {
    const normalized = normalizeUrl(input.url);
    if (!normalized) {
      throw new ORPCError("BAD_REQUEST", { message: "链接必须是 http(s) 地址" });
    }
    const email = input.email || context.user?.email || null;
    if (!email) {
      throw new ORPCError("BAD_REQUEST", { message: "请留一个邮箱，方便通知审核结果" });
    }

    // URL 去重放在限流之前：撞了重复链接不该消耗每小时的提交额度。
    // 已在列表或队列中的拒绝；此前被拒绝的允许重新提交（复用原行）。
    const existing = await context.db
      .select({ id: friend.id, url: friend.url, status: friend.status })
      .from(friend);
    const dup = existing.find((f) => normalizeUrl(f.url) === normalized);
    if (dup && dup.status !== "rejected") {
      throw new ORPCError("CONFLICT", {
        message: dup.status === "pending" ? "这个链接已经在审核队列里啦" : "这个链接已经在友链里啦",
      });
    }

    // 频率限制：同 IP 每小时最多 3 次（redis 不可用时放行）。
    // expire 带 NX：INCR 后即使中途出错也不会留下永不过期的封禁 key。
    const role = (context.user as { role?: string } | null)?.role;
    if (role !== "admin" && role !== "owner") {
      try {
        const key = KEYS.friendApply(clientIp(context.headers));
        const count = await redis.incr(key);
        await redis.expire(key, 3600, "NX");
        if (count > APPLY_LIMIT_PER_HOUR) {
          throw new ORPCError("TOO_MANY_REQUESTS", {
            message: "提交太频繁啦，过会儿再试 ✿",
          });
        }
      } catch (e) {
        if (e instanceof ORPCError) throw e;
      }
    }

    const data = {
      name: input.name,
      url: input.url.trim(),
      avatarUrl: input.avatarUrl ?? context.user?.image ?? null,
      description: input.description?.trim() || null,
      email,
      message: input.message?.trim() || null,
      applicantId: context.user?.id ?? null,
      status: "pending",
      reachable: null,
      backlinked: null,
      failCount: 0,
      checkedAt: null, // 复用被拒绝的旧行时，清掉过期的检测时间
    };
    const [row] = dup
      ? await context.db.update(friend).set(data).where(eq(friend.id, dup.id)).returning()
      : await context.db.insert(friend).values(data).returning();

    void notifyOwnerFriendApply(row!).catch(() => {});
    // 提前跑一次检测，审核时就能看到存活/反链参考。
    void checkFriend(row!).catch(() => {});
    return { id: row!.id };
  }),

  adminList: adminProcedure.handler(({ context }) =>
    context.db.select().from(friend).orderBy(desc(friend.createdAt)),
  ),

  review: adminProcedure
    .input(
      z.object({
        id: z.string().min(1),
        action: z.enum(["approve", "reject"]),
        group: z.string().trim().max(30).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const f = await context.db.query.friend.findFirst({ where: eq(friend.id, input.id) });
      if (!f) throw new ORPCError("NOT_FOUND");
      const approved = input.action === "approve";
      // 新通过的友链排到末尾，避免 sortOrder=0 把整组顺序打乱。
      let sortOrder = f.sortOrder;
      if (approved && f.status === "pending") {
        const [agg] = await context.db.select({ top: max(friend.sortOrder) }).from(friend);
        sortOrder = (agg?.top ?? 0) + 1;
      }
      const [updated] = await context.db
        .update(friend)
        .set({
          status: approved ? "active" : "rejected",
          group: input.group?.trim() || f.group || (approved ? "朋友" : null),
          sortOrder,
        })
        .where(eq(friend.id, f.id))
        .returning();
      if (!updated) notFound();
      void notifyApplicantReviewResult(updated, approved).catch(() => {});
      if (approved) void checkFriend(updated).catch(() => {});
      return updated;
    }),

  check: adminProcedure
    .input(z.object({ id: z.string().min(1).optional() }).optional())
    .handler(async ({ context, input }) => {
      if (input?.id) {
        const f = await context.db.query.friend.findFirst({ where: eq(friend.id, input.id) });
        if (!f) throw new ORPCError("NOT_FOUND");
        const updated = await checkFriend(f);
        return { queued: 1, friend: updated };
      }
      // 全量检测串行跑可能要几分钟，扔到后台，前端稍后刷新看结果。
      const queued = await context.db.$count(friend, listed);
      void runFriendChecks().catch(() => {});
      return { queued, friend: null };
    }),

  create: adminProcedure.input(friendWriteSchema).handler(async ({ context, input }) => {
    const [row] = await context.db.insert(friend).values(input).returning();
    return row!;
  }),

  update: adminProcedure.input(updateSchema).handler(async ({ context, input }) => {
    const { id, ...data } = input;
    const [row] = await context.db.update(friend).set(data).where(eq(friend.id, id)).returning();
    return row ?? notFound();
  }),

  delete: adminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const [row] = await context.db.delete(friend).where(eq(friend.id, input.id)).returning();
      return row ?? notFound();
    }),
};
