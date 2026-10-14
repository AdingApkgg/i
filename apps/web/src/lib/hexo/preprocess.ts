/**
 * Convert Butterfly/Hexo tag-plugins in the imported markdown into JSX that MDX
 * can compile against our component map (see components/content/blocks/*). Children that
 * should stay markdown are wrapped in blank lines so MDX re-parses them.
 *
 * Emitted contract (must match the components):
 *   <Note color icon? flavor?>md</Note>
 *   <HideToggle title color?>md</HideToggle>
 *   <Btn url text icon? variant? />
 *   <Tabs><Tab label>md</Tab>…</Tabs>
 *   <DPlayer url pic? />
 *   <Meting id server type … />
 *   <Timeline title?><TimelineItem label>md</TimelineItem>…</Timeline>
 *   <Gallery>md(images)</Gallery>
 *   <GalleryGroup name desc url cover />
 */

const IMG_BASE = "https://gh.saop.cc";
function resolveImg(u: string): string {
  const s = u.trim().replace(/^["']|["']$/g, "");
  if (/^https?:\/\//.test(s) || s.startsWith("data:")) return s;
  return `${IMG_BASE}${s.startsWith("/") ? "" : "/"}${s}`;
}

const attr = (s: string) =>
  String(s ?? "")
    .replace(/"/g, "&quot;")
    .trim();
const wrap = (s: string) => `\n\n${s.trim()}\n\n`;

/** Split a hexo comma-arg list respecting nothing fancy (these tags are simple). */
function splitArgs(s: string): string[] {
  return s.split(",").map((x) => x.trim().replace(/^['"]|['"]$/g, ""));
}

/** Parse `{% name ...args %}BODY{% endname %}` paired blocks (non-greedy, nestable-safe enough). */
function replacePaired(
  src: string,
  name: string,
  fn: (args: string, body: string) => string,
): string {
  // 参数里可能有 %（「卡 45%」、带 %xx 的地址），所以匹配到 %} 为止而不是 [^%]*；
  // 名字后不能紧跟字母，否则 gallery 会吃掉 galleryGroup
  const re = new RegExp(
    `\\{%\\s*${name}(?![A-Za-z])((?:(?!%\\}).)*?)%\\}([\\s\\S]*?)\\{%\\s*end${name}\\s*%\\}`,
    "g",
  );
  return src.replace(re, (_m, args, body) => fn(String(args).trim(), String(body)));
}

/**
 * 代码块和行内代码里的内容要原样保留（演示标签语法的文章会在代码里写 `{% gallery %}`），
 * 处理前先换成占位符，最后再还原。
 */
function protectCode(input: string): { text: string; restore: (s: string) => string } {
  const saved: string[] = [];
  const hold = (m: string) => `\uE000${saved.push(m) - 1}\uE000`;
  const text = input
    .replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1[ \t]*$/gm, hold)
    .replace(/`[^`\n]+`/g, hold);
  return { text, restore: (s) => s.replace(/\uE000(\d+)\uE000/g, (_m, i) => saved[Number(i)]!) };
}

export function hexoToMdx(input: string): string {
  const code = protectCode(input);
  return code.restore(transform(code.text));
}

function transform(input: string): string {
  let s = input;

  // ---- tabs (contains <!-- tab X --> … <!-- endtab? --> markers) ----
  s = replacePaired(s, "tabs", (_args, body) => {
    const parts = body.split(/<!--\s*tab\s+/i).slice(1);
    const tabs = parts.map((p) => {
      const nl = p.indexOf("\n");
      const label = attr(
        p
          .slice(0, nl)
          .replace(/-->\s*$/, "")
          .trim(),
      );
      let content = p.slice(nl + 1);
      content = content.replace(/<!--\s*endtab\s*-->/gi, "").trim();
      return `<Tab label="${label}">${wrap(content)}</Tab>`;
    });
    return `\n\n<Tabs>${tabs.join("")}</Tabs>\n\n`;
  });

  // ---- timeline (<!-- timeline LABEL --> blocks) ----
  s = replacePaired(s, "timeline", (args, body) => {
    const title = attr(splitArgs(args)[0] ?? "");
    const parts = body.split(/<!--\s*timeline\s+/i).slice(1);
    const items = parts.map((p) => {
      const nl = p.indexOf("\n");
      const label = attr(
        p
          .slice(0, nl)
          .replace(/-->\s*$/, "")
          .trim(),
      );
      const content = p
        .slice(nl + 1)
        .replace(/<!--\s*endtimeline\s*-->/gi, "")
        .trim();
      return `<TimelineItem label="${label}">${wrap(content)}</TimelineItem>`;
    });
    return `\n\n<Timeline title="${title}">${items.join("")}</Timeline>\n\n`;
  });

  // ---- note ----
  s = replacePaired(s, "note", (args, body) => {
    const tokens = args.match(/'[^']*'|"[^"]*"|\S+/g) ?? [];
    const styles = new Set(["modern", "flat", "simple", "disabled"]);
    let color = "";
    let icon = "";
    let flavor = "";
    for (const t of tokens) {
      const bare = t.replace(/^['"]|['"]$/g, "");
      if (bare === "no-icon") icon = "none";
      else if (styles.has(bare)) flavor = bare;
      else if (/^(fa|fas|far|fab|fa-)/.test(bare) || t.startsWith("'")) icon = bare;
      else if (!color) color = bare;
    }
    return `\n\n<Note color="${attr(color)}" icon="${attr(icon)}" flavor="${attr(flavor)}">${wrap(body)}</Note>\n\n`;
  });

  // ---- hideToggle / hideBlock ----
  for (const name of ["hideToggle", "hideBlock"]) {
    s = replacePaired(s, name, (args, body) => {
      const a = splitArgs(args);
      // 无参数时 splitArgs 返回 [""]，用 || 才能落到默认标题
      const title = attr(a[0] || "详情");
      const color = attr(a[1] ?? "");
      return `\n\n<HideToggle title="${title}" color="${color}">${wrap(body)}</HideToggle>\n\n`;
    });
  }

  // ---- gallery (image grid; keep inner markdown images) ----
  s = replacePaired(s, "gallery", (_args, body) => `\n\n<Gallery>${wrap(body)}</Gallery>\n\n`);

  // ---- self-closing tags ----
  // btn: {% btn 'url',text,icon,variant %}
  s = s.replace(/\{%\s*btn\s+((?:(?!%\}).)*?)\s*%\}/g, (_m, a) => {
    const [url = "", text = "", icon = "", variant = ""] = splitArgs(a);
    return `<Btn url="${attr(resolveImg(url))}" text="${attr(text)}" icon="${attr(icon)}" variant="${attr(variant)}" />`;
  });
  // dplayer: {% dplayer "url=..." "pic=..." ... %}
  s = s.replace(/\{%\s*dplayer\s+((?:(?!%\}).)*?)\s*%\}/g, (_m, a) => {
    const url = /url=([^"'\s]+)/.exec(a)?.[1] ?? "";
    const pic = /pic=([^"'\s]+)/.exec(a)?.[1] ?? "";
    return `\n\n<DPlayer url="${attr(url)}" pic="${attr(resolveImg(pic))}" />\n\n`;
  });
  // galleryGroup: {% galleryGroup 'name' 'desc' 'url' cover %}
  s = s.replace(/\{%\s*galleryGroup\s+((?:(?!%\}).)*?)\s*%\}/g, (_m, a) => {
    const m = a.match(/'([^']*)'\s+'([^']*)'\s+'?([^\s']*)'?\s+(\S+)/);
    if (!m) return "";
    return `<GalleryGroup name="${attr(m[1])}" desc="${attr(m[2])}" url="${attr(m[3])}" cover="${attr(resolveImg(m[4]))}" />`;
  });

  // ---- <meting-js …> → <Meting … /> (hyphenated tag is invalid JSX) ----
  s = s.replace(/<meting-js\s+([^>]*)>(?:\s*<\/meting-js>)?/gi, (_m, a) => {
    const get = (k: string) => new RegExp(`${k}\\s*=\\s*"([^"]*)"`).exec(a)?.[1] ?? "";
    return `\n\n<Meting server="${attr(get("server") || "netease")}" type="${attr(get("type") || "song")}" mid="${attr(get("id"))}" />\n\n`;
  });

  // Any leftover unknown {% tag %} → strip (avoid breaking MDX)
  s = s.replace(/\{%[\s\S]*?%\}/g, "");
  // 剩下的 HTML 注释（不成对的 tab 标记等）MDX 不认，直接去掉
  s = s.replace(/<!--[\s\S]*?-->/g, "");

  // ---- harden remaining raw HTML so MDX doesn't choke ----
  s = s.replace(/\bclass=/g, "className=");
  s = s.replace(/\sstyle="[^"]*"/gi, ""); // inline string styles break MDX
  s = s.replace(/<(br|hr|img|input|meta|link|source|area|col)((?:[^>]*?))\s*\/?>/gi, "<$1$2 />");
  return s;
}
