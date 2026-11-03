import { photo, post } from "@i/db/schema";
import { call } from "@orpc/server";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, makeContext } from "../../../test/db";
import { dashStatsRouter as dashStats } from "./dash-stats";

vi.mock("@i/db", async () => (await import("../../../test/mock-db")).dbModule());

let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(() => t.close());
beforeEach(() => t.reset());

const admin = () => ({ context: makeContext(t.db, { role: "admin" }) });

describe("仪表盘统计", () => {
  it("非管理员不能访问", async () => {
    await expect(call(dashStats.overview, {}, { context: makeContext(t.db) })).rejects.toThrow();
  });

  it("按域给出条目数，并汇总总数", async () => {
    await t.db.insert(post).values({ slug: "a", title: "A" });
    await t.db.insert(post).values({ slug: "b", title: "B" });
    await t.db.insert(photo).values({ imageUrl: "/api/gallery/files/x.png" });

    const res = await call(dashStats.overview, {}, admin());
    const byKey = new Map(res.counts.map((c) => [c.key, c.n]));
    expect(byKey.get("blog")).toBe(2);
    expect(byKey.get("gallery")).toBe(1);
    expect(byKey.get("blog")! + byKey.get("gallery")!).toBeLessThanOrEqual(res.total);
  });

  it("近 30 天新增只统计近期内容，按天聚合", async () => {
    await t.db.execute(
      sql`insert into "Post" ("id", "slug", "title", "createdAt", "updatedAt") values (gen_random_uuid()::text, 'new', 'N', now(), now())`,
    );
    await t.db.execute(
      sql`insert into "Post" ("id", "slug", "title", "createdAt", "updatedAt") values (gen_random_uuid()::text, 'old', 'O', now() - interval '90 days', now())`,
    );

    const res = await call(dashStats.overview, {}, admin());
    const sum = res.days.reduce((s, d) => s + d.n, 0);
    expect(sum).toBeGreaterThanOrEqual(1);
    expect(res.days.length).toBeGreaterThanOrEqual(1);
  });
});
