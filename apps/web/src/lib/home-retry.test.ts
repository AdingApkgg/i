import { describe, expect, it } from "vitest";
import type { HomeState } from "./home-content";
import { createHomeRetry } from "./home-retry";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("首页模块真实重试的生命周期", () => {
  it("点击后立刻进入加载态，等待实际读取结果，而非恢复旧快照", async () => {
    const request = deferred<string[]>();
    const states: HomeState<string>[] = [];
    let finished = 0;
    const retry = createHomeRetry(
      () => request.promise,
      (state) => states.push(state),
      () => finished++,
    );
    const task = retry.run();
    expect(states).toEqual([{ status: "loading", items: [] }]);
    expect(finished).toBe(0);
    request.resolve(["服务器刚返回的文章"]);
    await task;
    expect(states).toEqual([
      { status: "loading", items: [] },
      { status: "ready", items: ["服务器刚返回的文章"] },
    ]);
    expect(finished).toBe(1);
  });

  it("待处理期间重复触发只读一次，不启动并行请求", async () => {
    const request = deferred<string[]>();
    let reads = 0;
    const states: HomeState<string>[] = [];
    const retry = createHomeRetry(
      () => {
        reads++;
        return request.promise;
      },
      (state) => states.push(state),
      () => {},
    );
    const first = retry.run();
    const duplicate = retry.run();
    expect(reads).toBe(1);
    request.resolve(["唯一结果"]);
    await Promise.all([first, duplicate]);
    expect(states).toEqual([
      { status: "loading", items: [] },
      { status: "ready", items: ["唯一结果"] },
    ]);
  });

  it("再次失败仍显示模块错误，不把失败伪装成成功空结果", async () => {
    const states: HomeState<string>[] = [];
    let finished = 0;
    const retry = createHomeRetry<string>(
      async () => {
        throw new Error("private-transport-detail");
      },
      (state) => states.push(state),
      () => finished++,
    );
    await retry.run();
    expect(states).toEqual([
      { status: "loading", items: [] },
      { status: "error", items: [] },
    ]);
    expect(finished).toBe(1);
    expect(JSON.stringify(states)).not.toContain("private-transport-detail");
  });

  it("真实空返回保持为空，不从模板或历史数据补出文章", async () => {
    const states: HomeState<string>[] = [];
    const retry = createHomeRetry(
      async () => [],
      (state) => states.push(state),
      () => {},
    );
    await retry.run();
    expect(states).toEqual([
      { status: "loading", items: [] },
      { status: "ready", items: [] },
    ]);
  });

  it("离页取消后即使上游不遵守中止，也不更新状态或抢回焦点", async () => {
    const request = deferred<string[]>();
    const states: HomeState<string>[] = [];
    let signal: AbortSignal | undefined;
    let finished = 0;
    const retry = createHomeRetry(
      (input) => {
        signal = input;
        return request.promise;
      },
      (state) => states.push(state),
      () => finished++,
    );
    const task = retry.run();
    retry.cancel();
    expect(signal?.aborted).toBe(true);
    request.resolve(["离页后的旧结果"]);
    await task;
    expect(states).toEqual([{ status: "loading", items: [] }]);
    expect(finished).toBe(0);
  });

  it("取消旧请求再读取时，迟到的旧结果不能覆盖新结果", async () => {
    const old = deferred<string[]>();
    const fresh = deferred<string[]>();
    let reads = 0;
    const states: HomeState<string>[] = [];
    const retry = createHomeRetry(
      () => (++reads === 1 ? old.promise : fresh.promise),
      (state) => states.push(state),
      () => {},
    );
    const first = retry.run();
    retry.cancel();
    const second = retry.run();
    fresh.resolve(["新结果"]);
    await second;
    old.resolve(["旧结果"]);
    await first;
    expect(states).toEqual([
      { status: "loading", items: [] },
      { status: "loading", items: [] },
      { status: "ready", items: ["新结果"] },
    ]);
  });
});
