import { redis } from "@i/db";
import { publicProcedure, router } from "../trpc";

export const healthRouter = router({
  status: publicProcedure.query(async ({ ctx }) => {
    const db = await ctx.db
      .$queryRaw`SELECT 1`.then(() => true)
      .catch(() => false);
    const redisOk = await redis
      .ping()
      .then((r) => r === "PONG")
      .catch(() => false);
    const posts = await ctx.db.post.count().catch(() => 0);
    return { db, redis: redisOk, posts };
  }),
});
