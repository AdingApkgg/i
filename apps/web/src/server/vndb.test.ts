import { describe, expect, it, vi } from "vitest";
import { createVndbClient } from "./vndb";

const novel = {
  id: "v4",
  title: "CLANNAD",
  titles: [{ lang: "zh-Hans", title: "克兰纳德", official: true }],
  description: "Hello [spoiler]secret[/spoiler] [b]world[/b]",
  released: "2004-04-28",
  developers: [{ name: "Key" }],
  rating: 86.4,
  image: { url: "https://t.vndb.org/cv/12/123.jpg", sexual: 0, violence: 0 },
};
const reply = (data: unknown) =>
  new Response(JSON.stringify(data), { headers: { "content-type": "application/json" } });

describe("VNDB metadata", () => {
  it("normalizes candidates without mixing personal rating; caches identical reads", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      reply({
        results: [
          novel,
          {
            ...novel,
            id: "v5",
            title: "Fan game",
            titles: [],
            image: { ...novel.image, sexual: 1 },
          },
        ],
      }),
    );
    const search = createVndbClient(fetcher, 0);
    const result = await search("CLANNAD");
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      vndbId: "v4",
      title: "克兰纳德",
      originalTitle: "CLANNAD",
      brand: "Key",
      vndbRating: 8.64,
      descriptionOriginal: novel.description,
      released: "2004-04-28",
    });
    expect(result[0]).not.toHaveProperty("rating");
    expect(result[1]!.coverUrl).toBe("");
    await search("CLANNAD");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe("https://api.vndb.org/kana/vn");
  });
  it("rejects broken responses and handles rate limits without forwarding body", async () => {
    await expect(
      createVndbClient(async () => reply({ results: [{}] }), 0)("test"),
    ).rejects.toMatchObject({ code: "BAD_GATEWAY" });
    await expect(
      createVndbClient(
        async () => new Response("private upstream diagnostic", { status: 429 }),
        0,
      )("test"),
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});
