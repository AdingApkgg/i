import { describe, expect, it } from "vitest";
import { seo } from "./seo";

const matches = [{ id: "root", loaderData: { siteUrl: "https://i.example" } }];
const find = (tags: ReturnType<typeof seo>, key: string) =>
  tags.find((t) => ("property" in t && t.property === key) || ("name" in t && t.name === key)) as
    | { property?: string; name?: string; content?: string }
    | undefined;

describe("seo", () => {
  it("默认：站点标题、描述、默认分享图（绝对地址），无 canonical / noindex", () => {
    const tags = seo({ matches });
    expect(tags).toContainEqual({ title: "Asuna · 个人空间" });
    expect(find(tags, "og:image")).toEqual({
      property: "og:image",
      content: "https://i.example/og.png",
    });
    expect(tags.some((t) => "rel" in t && t.rel === "canonical")).toBe(false);
    expect(find(tags, "robots")).toBeUndefined();
  });

  it("文章：标题模板、canonical / og:url、article 字段、自定义分享图", () => {
    const tags = seo(
      { matches },
      {
        title: "你好",
        path: "/blog/hello",
        image: "/og/blog/hello.png",
        type: "article",
        publishedTime: new Date("2024-01-02T03:04:05Z"),
        tags: ["a", "b"],
      },
    );
    expect(tags).toContainEqual({ title: "你好 · Asuna" });
    expect(find(tags, "og:title")?.content).toBe("你好");
    expect(tags).toContainEqual({
      tagName: "link",
      rel: "canonical",
      href: "https://i.example/blog/hello",
    });
    expect(find(tags, "og:image")?.content).toBe("https://i.example/og/blog/hello.png");
    expect(find(tags, "article:published_time")?.content).toBe("2024-01-02T03:04:05.000Z");
    expect(tags.filter((t) => "property" in t && t.property === "article:tag")).toHaveLength(2);
  });

  it("noindex 与缺省 origin 兜底", () => {
    const tags = seo({ matches: [] }, { title: "404", noindex: true });
    expect(find(tags, "robots")?.content).toBe("noindex");
    expect(find(tags, "og:image")?.content).toMatch(/^http:\/\/localhost:3000\/og\.png$/);
  });
});
