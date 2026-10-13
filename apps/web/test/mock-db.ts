/**
 * `vi.mock("@i/db", …)` 的基础实现：保留真实的表定义与错误工具，
 * 但不加载连接池（client.ts）和 Redis（redis.ts 会立即建连）。
 * 测试里通过 context.db 注入 PGlite 实例。
 *
 *   vi.mock("@i/db", async () => ({ ...(await dbModule()), redis: fakeRedis }));
 */
export async function dbModule() {
  const schema = await import("@i/db/schema");
  const errors = await import("@i/db/errors");
  return {
    ...schema,
    ...errors,
    db: null,
    redis: null,
    KEYS: { friendApply: (ip: string) => `friend:apply:${ip}` },
  };
}
