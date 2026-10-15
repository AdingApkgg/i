import { afterEach, describe, expect, it, vi } from "vitest";
import { activeLyricIndex, loadLyrics, parseLyrics } from "./lyrics";

afterEach(() => vi.unstubAllGlobals());

describe("LRC 歌词", () => {
  it("解析重复时间标签和不同精度，并按时间排序", () => {
    expect(parseLyrics("[ti:歌名]\n[00:04.567][00:01.2]第一行\r\n[00:03.45]第二行")).toEqual({
      lines: [
        { time: 1.2, text: "第一行" },
        { time: 3.45, text: "第二行" },
        { time: 4.567, text: "第一行" },
      ],
      text: [],
    });
  });

  it("整份歌词应用毫秒 offset，负数不产生负播放位置", () => {
    expect(parseLyrics("[00:01]开始\n[offset:500]").lines).toEqual([{ time: 1.5, text: "开始" }]);
    expect(parseLyrics("[offset:-1500]\n[00:01]开始\n[00:03]继续").lines).toEqual([
      { time: 0, text: "开始" },
      { time: 1.5, text: "继续" },
    ]);
  });

  it("同一时间的原文与翻译一起显示，不重复相同文本", () => {
    expect(parseLyrics("[00:01]Hello\n[00:01]你好\n[00:01]Hello").lines).toEqual([
      { time: 1, text: "Hello\n你好" },
    ]);
  });

  it("歌词正文里的方括号不能被当作时间标签删掉", () => {
    expect(parseLyrics("[00:01]Hello [world]").lines).toEqual([{ time: 1, text: "Hello [world]" }]);
  });

  it("空白或仅元信息为无歌词，纯文本保留供阅读", () => {
    expect(parseLyrics("\uFEFF[ar:作者]\n[ti:歌名]\n\n")).toEqual({ lines: [], text: [] });
    expect(parseLyrics("第一行\n\n第二行")).toEqual({ lines: [], text: ["第一行", "第二行"] });
  });

  it("空的时间行不能吞掉仍可阅读的纯文本", () => {
    expect(parseLyrics("[00:00]\n没有时间戳的歌词")).toEqual({
      lines: [],
      text: ["没有时间戳的歌词"],
    });
  });

  it("英文段落标题与歌手标签是内联歌词，不是地址协议", async () => {
    expect(await loadLyrics("Chorus:\nHello world")).toEqual({
      lines: [],
      text: ["Chorus:", "Hello world"],
    });
    expect((await loadLyrics("Singer: hello")).text).toEqual(["Singer: hello"]);
  });

  it("定位首句前、句间、回跳和末句之后的当前行", () => {
    const lines = [
      { time: 1, text: "一" },
      { time: 3, text: "二" },
    ];
    expect([0, 1, 2.9, 3, 100, 0.5].map((time) => activeLyricIndex(lines, time))).toEqual([
      -1, 0, 0, 1, 1, -1,
    ]);
    expect(activeLyricIndex([], 10)).toBe(-1);
  });

  it("加载远程 LRC 并传递取消信号，内联歌词不用网络", async () => {
    const fetch = vi.fn(async () => new Response("[00:02]远程歌词"));
    vi.stubGlobal("fetch", fetch);
    const signal = new AbortController().signal;
    expect(await loadLyrics("https://example.com/song.lrc", signal)).toEqual({
      lines: [{ time: 2, text: "远程歌词" }],
      text: [],
    });
    expect(fetch.mock.calls[0]).toEqual(["https://example.com/song.lrc", { signal }]);
    expect((await loadLyrics("[00:01]内联歌词")).lines[0]?.text).toBe("内联歌词");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("请求失败与不安全协议可由界面展示失败，不能当成歌词", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );
    await expect(loadLyrics("https://example.com/song.lrc")).rejects.toThrow();
    await expect(loadLyrics("javascript:alert(1)")).rejects.toThrow();
    await expect(loadLyrics("data:text/plain,lyrics")).rejects.toThrow();
  });
});
