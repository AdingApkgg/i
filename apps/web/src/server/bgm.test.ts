import { describe, expect, it, vi } from "vitest";
import { createBgmClient } from "./bgm";

const subject = {
  id: 20424,
  type: 4,
  name: "Summer Pockets",
  name_cn: "夏日口袋",
  summary: "一段夏天的故事",
  date: "2018-06-29",
  platform: "PC",
  images: {
    large: "https://lain.bgm.tv/pic/cover/l/ab/cd/20424_abcdef.jpg",
    common: "https://lain.bgm.tv/pic/cover/c/ab/cd/20424_abcdef.jpg",
  },
  rating: { score: 8.36 },
  infobox: [
    { key: "开发", value: [{ v: "Key" }] },
    {
      key: "平台",
      value: [{ v: "PC" }, { v: "PS4" }, { v: "Nintendo Switch" }],
    },
    { key: "别名", value: [{ v: "サマポケ" }] },
  ],
  tags: [
    { name: "Key", count: 300 },
    { name: "游戏", count: 260 },
    { name: "Galgame", count: 240 },
    { name: "夏日", count: 120 },
    { name: "夏日", count: 90 },
  ],
};
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

describe("Bangumi metadata", () => {
  it("normalizes subjects, filters noise tags, and serves repeats from cache", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => reply({ data: [subject] }));
    const client = createBgmClient(fetcher, 0);
    const result = await client.search("夏日口袋");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      bgmId: 20424,
      title: "夏日口袋",
      originalTitle: "Summer Pockets",
      brand: "Key",
      released: "2018-06-29",
      bgmRating: 8.4,
      descriptionOriginal: "一段夏天的故事",
      tags: ["Key", "夏日"],
      platforms: ["PC", "PS4", "Nintendo Switch"],
      link: "https://bgm.tv/subject/20424",
    });
    expect(result[0]!.coverUrl).toBe(subject.images.large);
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toEqual({
      keyword: "夏日口袋",
      filter: { type: [4] },
    });
    await client.search("夏日口袋");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("fetches a single subject by id and drops non-whitelisted covers", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      reply({ ...subject, name_cn: "", images: { large: "https://evil.test/a.jpg" } }),
    );
    const client = createBgmClient(fetcher, 0);
    const [detail] = await client.fetchOne(20424);
    expect(detail?.title).toBe("Summer Pockets");
    expect(detail?.coverUrl).toBe("");
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://api.bgm.tv/v0/subjects/20424");
  });

  it("rejects broken payloads and rate limits without leaking upstream bodies", async () => {
    await expect(
      createBgmClient(async () => reply({ data: [{}] }), 0).search("x"),
    ).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    await expect(
      createBgmClient(async () => new Response("private diagnostic", { status: 429 }), 0).search(
        "x",
      ),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
    await expect(
      createBgmClient(async () => reply({ data: [] }), 0).fetchOne(0),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
