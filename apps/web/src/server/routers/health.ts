import { post, redis } from "@i/db";
import { sql } from "drizzle-orm";
import { publicProcedure } from "../orpc";

export const healthRouter = {
  status: publicProcedure.handler(async ({ context }) => {
    const db = await context.db
      .execute(sql`SELECT 1`)
      .then(() => true)
      .catch(() => false);
    const redisOk = await redis
      .ping()
      .then((r) => r === "PONG")
      .catch(() => false);
    const posts = await context.db.$count(post).catch(() => 0);
    return { db, redis: redisOk, posts };
  }),
};
