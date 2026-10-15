import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Node 里没有 localStorage：用内存版替身
function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size;
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
  vi.resetModules();
});
afterEach(() => vi.unstubAllGlobals());

const song = (name: string) => ({ name, artist: "a", url: `https://x/${name}.mp3`, pic: "" });

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("看板娘偏好", () => {
  it("从旧版散落的 key 迁移过来，之后写新 key", async () => {
    localStorage.setItem("waifu.hidden", "1");
    localStorage.setItem("waifu.group", "2");
    localStorage.setItem("waifu.costume", "5");
    const { useMascotStore } = await import("./mascot");
    expect(useMascotStore.getState().ready).toBe(false);

    await useMascotStore.persist.rehydrate();
    expect(useMascotStore.getState()).toMatchObject({
      ready: true,
      hidden: true,
      group: 2,
      costume: 5,
    });

    useMascotStore.getState().show();
    expect(JSON.parse(localStorage.getItem("i.mascot")!).state).toEqual({
      hidden: false,
      group: 2,
      costume: 5,
    });
  });

  it("没有任何记录：默认显示、未选人物", async () => {
    const { useMascotStore } = await import("./mascot");
    await useMascotStore.persist.rehydrate();
    expect(useMascotStore.getState()).toMatchObject({ ready: true, hidden: false, group: null });
  });
});

describe("播放器", () => {
  it("默认歌单只在队列为空时填入；切歌首尾循环并请求重新加载", async () => {
    const { usePlayerStore } = await import("./player");
    const s = usePlayerStore.getState;
    s().initQueue([song("a"), song("b"), song("c")]);
    s().initQueue([song("x")]);
    expect(
      s()
        .queue.map((x) => x.name)
        .sort(),
    ).toEqual(["a", "b", "c"]);

    s().prev();
    expect(s()).toMatchObject({ index: 2, load: { seq: 1, autoplay: true } });
    s().next();
    expect(s()).toMatchObject({ index: 0, load: { seq: 2 } });
  });

  it("play() 换成新歌单、展开面板并自动播放；拉取失败保持原样", async () => {
    const fetchMock = vi.fn(async (_url: string) => Response.json([song("p1"), song("p2")]));
    vi.stubGlobal("fetch", fetchMock);
    const { usePlayerStore } = await import("./player");
    const s = usePlayerStore.getState;
    await s().play("netease", "playlist", "123");
    expect(fetchMock.mock.calls[0]![0]).toContain("type=playlist&id=123");
    expect(s()).toMatchObject({ index: 0, expanded: true, load: { autoplay: true } });
    expect(s().queue.map((x) => x.name)).toEqual(["p1", "p2"]);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );
    await s().play("netease", "playlist", "456");
    expect(s().queue.map((x) => x.name)).toEqual(["p1", "p2"]);
  });

  it("连续选播时，较早请求晚返回也不能覆盖最后选择的歌单", async () => {
    const first = deferredResponse();
    const second = deferredResponse();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise),
    );
    const { usePlayerStore } = await import("./player");
    const s = usePlayerStore.getState;
    const older = s().play("netease", "playlist", "first");
    const latest = s().play("netease", "playlist", "second");
    second.resolve(Response.json([song("latest")]));
    await latest;
    const acceptedLoad = s().load;
    first.resolve(Response.json([song("stale")]));
    await older;
    expect(s().queue).toEqual([song("latest")]);
    expect(s().load).toEqual(acceptedLoad);
  });

  it("最后选播失败时保留当前播放，不接受之前仍未完成的选播", async () => {
    const first = deferredResponse();
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockResolvedValueOnce(new Response(null, { status: 500 })),
    );
    const { usePlayerStore } = await import("./player");
    const s = usePlayerStore.getState;
    s().initQueue([song("current")]);
    const older = s().play("netease", "playlist", "first");
    await s().play("netease", "playlist", "second");
    first.resolve(Response.json([song("stale")]));
    await older;
    expect(s().queue).toEqual([song("current")]);
    expect(s().load.seq).toBe(0);
  });

  it("等待选播歌单时手动切歌，旧请求不能打断当前选择", async () => {
    const pending = deferredResponse();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(pending.promise));
    const { usePlayerStore } = await import("./player");
    const s = usePlayerStore.getState;
    s().initQueue([song("a"), song("b")]);
    const queue = s().queue;
    const older = s().play("netease", "playlist", "pending");
    s().switchTo(1);
    const acceptedLoad = s().load;
    pending.resolve(Response.json([song("stale")]));
    await older;
    expect(s().queue).toEqual(queue);
    expect(s().index).toBe(1);
    expect(s().load).toEqual(acceptedLoad);
  });

  it("音量持久化，旧版的音量 key 会迁移", async () => {
    localStorage.setItem("i.player.volume", "0.8");
    const { usePlayerStore } = await import("./player");
    await usePlayerStore.persist.rehydrate();
    expect(usePlayerStore.getState().volume).toBe(0.8);
    usePlayerStore.getState().setVolume(0.5);
    expect(JSON.parse(localStorage.getItem("i.player")!).state).toEqual({
      volume: 0.5,
      muted: false,
    });
  });
});
