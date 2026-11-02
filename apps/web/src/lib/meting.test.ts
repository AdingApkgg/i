import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMeting } from "./meting";

afterEach(() => vi.unstubAllGlobals());
const track = {
  title: "INNOCENCE",
  author: "lasah",
  url: "https://api.i-meto.com/meting/api?server=netease&type=url&id=28484892&auth=signature",
  pic: "https://example.com/cover.jpg",
  lrc: "https://example.com/words.lrc",
};

describe("Meting 元数据兼容", () => {
  it("专辑和歌手使用支持该类型的接口，并将 title/author 转成播放器字段", async () => {
    vi.stubGlobal("fetch", async (url: string) => {
      if (new URL(url).hostname !== "api.i-meto.com")
        return Response.json({ error: "unknown type" });
      return Response.json([track]);
    });
    for (const type of ["album", "artist"]) {
      const songs = await fetchMeting("netease", type, "2808292");
      expect(songs[0]).toMatchObject({
        name: "INNOCENCE",
        artist: "lasah",
        url: "https://api.injahow.cn/meting/?server=netease&type=url&id=28484892",
      });
      expect(songs[0]?.sourceUrl).toBe("https://music.163.com/#/song?id=28484892");
    }
  });
  it("主接口返回空结果时，单曲仍可从备用接口恢复", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      if (++calls === 1) return Response.json([]);
      return Response.json([
        { name: "Test", artist: "A", url: "https://example.com/a.mp3", pic: "" },
      ]);
    });
    expect((await fetchMeting("netease", "song", "123"))[0]?.name).toBe("Test");
  });
  it("无效音源协议和错误对象不能成为队列中的歌曲", async () => {
    vi.stubGlobal("fetch", async () => Response.json([{ ...track, url: "javascript:alert(1)" }]));
    await expect(fetchMeting("netease", "song", "123")).rejects.toThrow();
  });
  it("专辑无结果时报告失败，不静默返回空队列", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ error: "unknown type" }));
    await expect(fetchMeting("netease", "album", "123")).rejects.toThrow();
  });
});

it("保留本站相对媒体地址以及内联歌词，不能让现有歌单和滚动歌词失效", async () => {
  vi.stubGlobal("fetch", async () =>
    Response.json([
      {
        name: "本地音乐",
        artist: "测试",
        url: "/audio/song.mp3",
        pic: "/cover.png",
        lrc: "[00:00]歌词正文",
      },
    ]),
  );
  expect((await fetchMeting("netease", "song", "123"))[0]).toMatchObject({
    url: "/audio/song.mp3",
    pic: "/cover.png",
    lrc: "[00:00]歌词正文",
  });
});
it("保留绝对音源附带的纯文本歌词", async () => {
  vi.stubGlobal("fetch", async () => Response.json([{ ...track, lrc: "没有时间戳的歌词" }]));
  expect((await fetchMeting("netease", "song", "123"))[0]?.lrc).toBe("没有时间戳的歌词");
});
