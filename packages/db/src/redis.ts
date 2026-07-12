import Redis from "ioredis";

const globalForRedis = globalThis as unknown as { redis: Redis | undefined };

export const redis: Redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
    maxRetriesPerRequest: 2,
    lazyConnect: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

/** Central place for Redis key builders so they don't drift across call sites. */
export const KEYS = {
  pageViews: (path: string) => `views:${path}`,
  monitorLatest: (targetId: string) => `monitor:latest:${targetId}`,
  siteCounter: (name: string) => `counter:${name}`,
};
