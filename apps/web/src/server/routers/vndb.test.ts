import { device, vn } from "@i/db/schema";
import { call } from "@orpc/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, makeContext } from "../../../test/db";
import { deviceRouter, vnRouter } from "./content";
import { vndbRouter } from "./vndb";

vi.mock("@i/db", async () => (await import("../../../test/mock-db")).dbModule());
vi.mock("@/lib/auth", () => ({ auth: {} }));
let t: Awaited<ReturnType<typeof createTestDb>>;
beforeAll(async () => {
  t = await createTestDb();
});
afterAll(() => t.close());
beforeEach(() => t.reset());
const ctx = (role?: "user" | "admin") => ({ context: makeContext(t.db, { role }) });
describe("VN and device editing", () => {
  it("protects VNDB search", async () => {
    await expect(call(vndbRouter.search, { query: "CLANNAD" }, ctx())).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(call(vndbRouter.search, { query: "CLANNAD" }, ctx("user"))).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });
  it("attaches metadata preserving personal fields and refuses duplicate VNDB ids", async () => {
    const [old] = await t.db
      .insert(vn)
      .values({ title: "Old", status: "通关", rating: 10, playHours: 50, note: "My note" })
      .returning();
    await call(
      vnRouter.update,
      {
        id: old!.id,
        vndbId: "v4",
        title: "CLANNAD",
        descriptionOriginal: "Original",
        vndbRating: 8.64,
      },
      ctx("admin"),
    );
    expect((await t.db.select().from(vn))[0]).toMatchObject({
      status: "通关",
      rating: 10,
      playHours: 50,
      note: "My note",
      vndbRating: 8.64,
    });
    await expect(
      call(vnRouter.create, { title: "Duplicate", vndbId: "v4" }, ctx("admin")),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await call(vnRouter.create, { title: "Unlinked one", vndbId: "" }, ctx("admin"));
    await call(vnRouter.create, { title: "Unlinked two", vndbId: "" }, ctx("admin"));
  });
  it("roundtrips device image, multiline specs, freeform date and notes", async () => {
    const row = await call(
      deviceRouter.create,
      {
        name: "Laptop",
        imageUrl: "/api/gallery/files/test.png",
        spec: "CPU: test\nRAM: 32G",
        acquired: "2024 年春天",
        note: "travel",
      },
      ctx("admin"),
    );
    expect(
      (await call(deviceRouter.list, undefined, ctx())).find((d) => d.id === row.id),
    ).toMatchObject({
      imageUrl: "/api/gallery/files/test.png",
      spec: "CPU: test\nRAM: 32G",
      acquired: "2024 年春天",
      note: "travel",
    });
    expect(await t.db.select().from(device)).toHaveLength(1);
  });
});
