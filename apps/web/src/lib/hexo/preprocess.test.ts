import { describe, expect, it } from "vitest";
import { hexoToMdx } from "./preprocess";

describe("hexoToMdx", () => {
  it("note：解析颜色 / 图标 / 风格，正文留作 markdown", () => {
    const out = hexoToMdx("{% note warning 'fas fa-bolt' flat %}\n**注意**\n{% endnote %}");
    expect(out).toContain('<Note color="warning" icon="fas fa-bolt" flavor="flat">');
    // 正文前后空行，MDX 才会重新按 markdown 解析
    expect(out).toContain("\n\n**注意**\n\n</Note>");
  });

  it("note no-icon", () => {
    expect(hexoToMdx("{% note info no-icon %}x{% endnote %}")).toContain(
      '<Note color="info" icon="none" flavor="">',
    );
  });

  it("tabs：按 <!-- tab X --> 拆分并去掉 endtab", () => {
    const src = [
      "{% tabs demo %}",
      "<!-- tab 第一页 -->",
      "一",
      "<!-- endtab -->",
      "<!-- tab 第二页 -->",
      "二",
      "<!-- endtab -->",
      "{% endtabs %}",
    ].join("\n");
    const out = hexoToMdx(src);
    expect(out).toContain('<Tab label="第一页">\n\n一\n\n</Tab>');
    expect(out).toContain('<Tab label="第二页">\n\n二\n\n</Tab>');
    expect(out).not.toContain("endtab");
  });

  it("timeline：标题 + 条目", () => {
    const src =
      "{% timeline 2024 %}\n<!-- timeline 01-01 -->\n元旦\n<!-- endtimeline -->\n{% endtimeline %}";
    const out = hexoToMdx(src);
    expect(out).toContain('<Timeline title="2024">');
    expect(out).toContain('<TimelineItem label="01-01">\n\n元旦\n\n</TimelineItem>');
  });

  it("hideToggle 缺省标题为「详情」", () => {
    expect(hexoToMdx("{% hideToggle %}藏起来{% endhideToggle %}")).toContain(
      '<HideToggle title="详情" color="">',
    );
  });

  it("btn：站内相对链接补全为旧站绝对地址", () => {
    expect(hexoToMdx("{% btn '/about/',关于,fas fa-user,block %}")).toBe(
      '<Btn url="https://gh.saop.cc/about/" text="关于" icon="fas fa-user" variant="block" />',
    );
  });

  it("dplayer：提取 url / pic，pic 相对路径补全", () => {
    const out = hexoToMdx('{% dplayer "url=https://v.example/a.mp4" "pic=/img/c.jpg" %}');
    expect(out).toContain(
      '<DPlayer url="https://v.example/a.mp4" pic="https://gh.saop.cc/img/c.jpg" />',
    );
  });

  it("<meting-js> 转为合法 JSX 的 <Meting />，缺省 server/type", () => {
    const out = hexoToMdx('<meting-js id="12345"></meting-js>');
    expect(out).toContain('<Meting server="netease" type="song" mid="12345" />');
    expect(out).not.toContain("meting-js");
  });

  it("未知 {% tag %} 直接剥掉，避免 MDX 编译失败", () => {
    expect(hexoToMdx("前{% unknown a b %}后")).toBe("前后");
  });

  it("原生 HTML 加固：class→className、去字符串 style、空元素自闭合", () => {
    const out = hexoToMdx('<div class="x" style="color:red">a<br>b</div><img src="/a.png">');
    expect(out).toBe('<div className="x">a<br />b</div><img src="/a.png" />');
  });

  it("属性里的双引号被转义", () => {
    expect(hexoToMdx(`{% btn 'https://a.b',say "hi" ok %}`)).toContain(
      'text="say &quot;hi&quot; ok"',
    );
  });
});
