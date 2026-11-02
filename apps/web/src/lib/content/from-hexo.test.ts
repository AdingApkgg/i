import { describe, expect, it } from "vitest";
import { hexoToDoc } from "./from-hexo";
import { plainText } from "./text";
import type { RichNode } from "./types";
import { assertValidDoc } from "./validate.server";

const types = (n: RichNode): string[] => [n.type, ...(n.content ?? []).flatMap(types)];

function convert(md: string) {
  const r = hexoToDoc(md);
  assertValidDoc(r.doc);
  return r;
}

describe("hexoToDoc", () => {
  it("普通 Markdown：标题、列表、代码块、表格、链接和格式", () => {
    const { doc, fallback } = convert(
      [
        "# 标题",
        "",
        "一段 **粗体** 和 *斜体*，还有 `code` 和 [链接](https://example.com)。",
        "",
        "- 一",
        "- 二",
        "",
        "1. 甲",
        "2. 乙",
        "",
        "```ts",
        "const a = 1;",
        "```",
        "",
        "| a | b |",
        "| - | -: |",
        "| 1 | 2 |",
      ].join("\n"),
    );
    expect(fallback).toBe(false);
    const t = types(doc);
    for (const x of ["heading", "bulletList", "orderedList", "codeBlock", "table", "tableHeader"])
      expect(t).toContain(x);
    expect(doc.content?.find((n) => n.type === "codeBlock")?.attrs?.language).toBe("ts");
  });

  it("任务列表 → taskList", () => {
    const { doc } = convert("- [x] 完成\n- [ ] 未完成");
    expect(doc.content?.[0]?.type).toBe("taskList");
    expect(doc.content?.[0]?.content?.[0]?.attrs?.checked).toBe(true);
  });

  it("段落里的图片拆成块级 image", () => {
    const { doc } = convert("前面 ![图](https://x/a.png) 后面");
    expect(doc.content?.map((n) => n.type)).toEqual(["paragraph", "image", "paragraph"]);
  });

  it("行内代码不叠加其他格式", () => {
    const { doc } = convert("**粗体里的 `code`**");
    const code = doc.content?.[0]?.content?.find((n) => n.text === "code");
    expect(code?.marks).toEqual([{ type: "code" }]);
  });

  it("列表项以图片开头时补一个空段落", () => {
    const { doc } = convert("- ![a](https://x/a.png)");
    expect(doc.content?.[0]?.content?.[0]?.content?.[0]?.type).toBe("paragraph");
  });

  it("note → callout，带颜色和图标", () => {
    const { doc } = convert("{% note warning 'fas fa-bell' %}\n小心\n{% endnote %}");
    const c = doc.content?.find((n) => n.type === "callout");
    expect(c?.attrs).toMatchObject({ color: "warning", icon: "fas fa-bell" });
    expect(plainText(c)).toContain("小心");
  });

  it("hideToggle → details", () => {
    const { doc } = convert("{% hideToggle 点我,blue %}\n藏起来的\n{% endhideToggle %}");
    const d = doc.content?.find((n) => n.type === "details");
    expect(d?.attrs?.color).toBe("blue");
    expect(plainText(d)).toContain("点我");
    expect(plainText(d)).toContain("藏起来的");
  });

  it("tabs → tabs / tab", () => {
    const { doc } = convert(
      "{% tabs t %}\n<!-- tab 第一 -->\n内容一\n<!-- endtab -->\n<!-- tab 第二 -->\n内容二\n<!-- endtab -->\n{% endtabs %}",
    );
    const tabs = doc.content?.find((n) => n.type === "tabs");
    expect(tabs?.content?.map((t) => t.attrs?.label)).toEqual(["第一", "第二"]);
  });

  it("btn → 行内 buttonLink", () => {
    const { doc } = convert("{% btn 'https://a.com',去看看,fas fa-link,pink %}");
    expect(types(doc)).toContain("buttonLink");
  });

  it("gallery → gallery（图片进属性）", () => {
    const { doc } = convert(
      "{% gallery %}\n![](https://x/1.png)\n![](https://x/2.png)\n{% endgallery %}",
    );
    const g = doc.content?.find((n) => n.type === "gallery");
    expect(g?.attrs?.images).toHaveLength(2);
  });

  it("dplayer / meting / galleryGroup / timeline", () => {
    const { doc } = convert(
      [
        '{% dplayer "url=https://v/a.m3u8" "pic=https://v/a.jpg" %}',
        "",
        '<meting-js server="netease" type="song" id="123"></meting-js>',
        "",
        "{% galleryGroup '名字' '描述' '/gallery/x' https://x/c.png %}",
        "",
        "{% timeline 年表 %}\n<!-- timeline 2024 -->\n发生了\n<!-- endtimeline -->\n{% endtimeline %}",
      ].join("\n"),
    );
    const t = types(doc);
    for (const x of ["video", "music", "galleryCard", "timeline", "timelineItem"])
      expect(t).toContain(x);
  });

  it("B 站 iframe → embed", () => {
    const { doc } = convert(
      '<iframe src="//player.bilibili.com/player.html?bvid=BV1xx411c7mD"></iframe>',
    );
    expect(doc.content?.find((n) => n.type === "embed")?.attrs?.src).toContain(
      "player.bilibili.com",
    );
  });

  it("正文里不成对的 < 和 { 自动转义，不回退", () => {
    const { doc, fallback } = convert("a < b 并且 {x 不成对，**git add <文件名>**");
    expect(fallback).toBe(false);
    expect(plainText(doc)).toContain("a < b 并且 {x 不成对");
    expect(plainText(doc)).toContain("<文件名>");
  });
});
