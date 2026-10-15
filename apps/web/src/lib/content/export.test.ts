import { describe, expect, it } from "vitest";
import { backupJson, exportHtml } from "./export.server";
import type { RichDoc } from "./types";

const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const doc: RichDoc = { type: "doc", content: [paragraph("已保存正文")] };
const record = {
  id: "post-1",
  title: "测试文章 <script>alert(1)</script>",
  slug: "test",
  content: doc,
  contentMd: "迁移前原文",
  status: "draft",
  tags: ["随笔"],
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-02-01T00:00:00Z"),
};
const origin = "https://example.com";

describe("JSON 正文备份", () => {
  it("同时保留文章、整页、草稿状态、元数据和原始 JSON，不改动正文", () => {
    const result = JSON.parse(
      backupJson([record], [{ id: "music", title: "音乐", content: doc }], origin),
    );
    expect(result).toMatchObject({
      format: "i-content-backup",
      version: 1,
      siteUrl: origin,
      posts: [
        { id: "post-1", status: "draft", tags: ["随笔"], content: doc, contentMd: "迁移前原文" },
      ],
      pages: [{ id: "music", content: doc }],
    });
    expect(result.posts[0].updatedAt).toBe("2026-02-01T00:00:00.000Z");
    expect(result.exportedAt).toEqual(expect.any(String));
    expect(record.content).toEqual(doc);
  });
});

describe("独立 HTML 导出", () => {
  it("生成有标题和样式的完整文档，转义标题和正文，站内资源转为绝对地址", () => {
    const html = exportHtml(
      {
        ...record,
        content: {
          type: "doc",
          content: [
            paragraph("<script>alert(2)</script>"),
            { type: "image", attrs: { src: "/api/gallery/files/a.png", alt: "图片" } },
          ],
        },
      },
      "/blog/test",
      origin,
    );
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toMatch(/<meta charset="utf-8"/i);
    expect(html).toContain("<style>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("&lt;script&gt;alert(2)&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain('src="https://example.com/api/gallery/files/a.png"');
    expect(html).toContain('href="https://example.com/blog/test"');
  });

  it("导出全部标签内容、时间轴和原生折叠块，不需要站点 JavaScript 才能阅读", () => {
    const content: RichDoc = {
      type: "doc",
      content: [
        {
          type: "tabs",
          content: [
            { type: "tab", attrs: { label: "第一项" }, content: [paragraph("第一项正文")] },
            { type: "tab", attrs: { label: "第二项" }, content: [paragraph("第二项正文")] },
          ],
        },
        {
          type: "timeline",
          attrs: { title: "历史" },
          content: [
            { type: "timelineItem", attrs: { label: "2026" }, content: [paragraph("时间轴正文")] },
          ],
        },
        {
          type: "details",
          content: [
            { type: "detailsSummary", content: [{ type: "text", text: "展开标题" }] },
            { type: "detailsContent", content: [paragraph("隐藏正文")] },
          ],
        },
      ],
    };
    const html = exportHtml({ title: "内容", content }, "/music", origin);
    for (const text of [
      "第一项",
      "第二项正文",
      "历史",
      "2026",
      "时间轴正文",
      "展开标题",
      "隐藏正文",
    ])
      expect(html).toContain(text);
    expect(html).toContain("<details");
    expect(html).not.toContain("<script");
  });

  it("保留代码文本和公式；音乐、视频和嵌入保留可阅读信息及来源", () => {
    const content: RichDoc = {
      type: "doc",
      content: [
        {
          type: "codeBlock",
          attrs: { language: "javascript", __html: "<script>injected</script>" },
          content: [{ type: "text", text: 'const a = "<b>";' }],
        },
        { type: "blockMath", attrs: { latex: "x^2", __html: "<script>injected</script>" } },
        { type: "music", attrs: { server: "netease", type: "song", mid: "123" } },
        { type: "video", attrs: { src: "/video.mp4", poster: "/cover.jpg" } },
        { type: "embed", attrs: { src: "https://youtu.be/abc" } },
      ],
    };
    const html = exportHtml({ title: "媒体", content }, "/music", origin);
    expect(html).toContain("const");
    expect(html).toMatch(/(?:&lt;|&#x3c;|&#60;)b(?:&gt;|>)/i);
    expect(html).toContain("<math");
    expect(html).toContain("https://music.163.com/#/song?id=123");
    expect(html).toContain('src="https://example.com/video.mp4"');
    expect(html).toContain("https://www.youtube-nocookie.com/embed/abc");
    expect(html).not.toContain("injected");
  });

  it("拒绝危险链接和媒体协议，按文本保留未知块的内容", () => {
    const content: RichDoc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "链接",
              marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
            },
          ],
        },
        { type: "image", attrs: { src: "javascript:alert(2)" } },
        { type: "video", attrs: { src: "data:text/html,evil" } },
        { type: "embed", attrs: { src: "https://evil.example/" } },
        { type: "futureNode", content: [paragraph("未知块中的正文")] },
      ],
    };
    const html = exportHtml({ title: "安全", content }, "/test", origin);
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("data:text/html");
    expect(html).not.toContain("evil.example");
    expect(html).toContain("未知块中的正文");
  });

  it("非网易云音乐保留平台和ID，并可回原站播放", () => {
    const content: RichDoc = {
      type: "doc",
      content: [{ type: "music", attrs: { server: "tencent", type: "song", mid: "003test" } }],
    };
    const html = exportHtml({ title: "音乐", content }, "/music", origin);
    expect(html).toContain('href="https://example.com/music">tencent');
    expect(html).toContain("003test");
    expect(html).toContain("回原站播放");
  });

  it("尚未迁移的旧正文以转义的原文保留，而不是导出空白", () => {
    const html = exportHtml(
      { title: "旧文", content: null, contentMd: "# 原文\n<script>test</script>" },
      "/old",
      origin,
    );
    expect(html).toContain("# 原文");
    expect(html).toContain("&lt;script&gt;test&lt;/script&gt;");
    expect(html).not.toContain("<script>");
  });
});
