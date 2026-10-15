export interface LyricLine {
  time: number;
  text: string;
}
export interface ParsedLyrics {
  lines: LyricLine[];
  text: string[];
}

/** LRC offset 以毫秒计；同一时刻的原文、翻译合为一个高亮块。 */
export function parseLyrics(source: string): ParsedLyrics {
  const offset = Number(/\[offset:([+-]?\d+)\]/i.exec(source)?.[1] ?? 0) / 1000;
  const timed = new Map<number, string[]>();
  const plain: string[] = [];
  for (const raw of source.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const tags = [...raw.matchAll(/\[(\d+):([0-5]?\d)(?:\.(\d{1,3}))?\]/g)];
    if (tags.length) {
      const text = raw.replace(/\[[^\]]*\]/g, "").trim();
      for (const tag of tags) {
        const seconds = Number(tag[1]) * 60 + Number(tag[2]) + Number(`0.${tag[3] ?? 0}`);
        const time = Math.max(0, Math.round((seconds + offset) * 1000) / 1000);
        const texts = timed.get(time) ?? [];
        if (!texts.includes(text)) texts.push(text);
        timed.set(time, texts);
      }
    } else {
      const text = raw.replace(/\[(?:ar|al|ti|au|by|offset|re|ve|length):[^\]]*\]/gi, "").trim();
      if (text) plain.push(text);
    }
  }
  const lines = [...timed].sort(([a], [b]) => a - b).map(([time, texts]) => ({
    time,
    text: texts.filter(Boolean).join("\n"),
  }));
  return { lines: lines.some((line) => line.text) ? lines : [], text: lines.length ? [] : plain };
}

export function activeLyricIndex(lines: LyricLine[], time: number): number {
  let low = 0, high = lines.length - 1;
  while (low <= high) {
    const mid = (low + high) >>> 1;
    if (lines[mid]!.time <= time) low = mid + 1;
    else high = mid - 1;
  }
  return high;
}

export async function loadLyrics(source: string, signal?: AbortSignal): Promise<ParsedLyrics> {
  const value = source.trim();
  if (/^(?:https?:\/\/|\/|\.\.?\/)/i.test(value)) {
    const response = await fetch(value, { signal });
    if (!response.ok) throw new Error(`歌词加载失败 (${response.status})`);
    return parseLyrics(await response.text());
  }
  if (/^[a-z][\w+.-]*:/i.test(value)) throw new Error("不支持的歌词地址");
  return parseLyrics(value);
}
