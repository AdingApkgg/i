import { afterEach, expect, it, vi } from "vitest";
import { Cubism2Mascot } from "./cubism2";

afterEach(() => vi.unstubAllGlobals());

it("不同画布使用独立 Core 槽位，销毁只清理自己的遮罩资源", async () => {
  const contexts: Record<number, unknown> = {};
  const masks: Record<number, unknown> = {};
  const buffers: Record<number, { framebuffer: unknown; renderbuffer: unknown }> = {};
  const sdk = {
    glContext: contexts,
    fTexture: masks,
    frameBuffers: buffers,
    init: vi.fn(),
    setGL: vi.fn((gl: unknown, index = 0) => {
      contexts[index] = gl;
    }),
  };
  const loadModel = vi.fn(() => ({
    saveParam() {},
    getCanvasWidth: () => 100,
    setMatrix() {},
  }));
  vi.stubGlobal("window", {
    Live2D: sdk,
    Live2DModelWebGL: { loadModel },
    MotionQueueManager: class {},
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url.endsWith(".json")
        ? Response.json({ model: "model.moc", textures: [] })
        : new Response(new Uint8Array([1])),
    ),
  );
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const makeCanvas = () => {
    const gl = { deleteTexture: vi.fn(), deleteFramebuffer: vi.fn(), deleteRenderbuffer: vi.fn() };
    const canvas = {
      width: 100,
      height: 200,
      getContext: () => gl,
      addEventListener() {},
      removeEventListener() {},
    } as unknown as HTMLCanvasElement;
    return { gl, engine: new Cubism2Mascot(canvas) };
  };
  const first = makeCanvas();
  const second = makeCanvas();
  await first.engine.load("/live2d/model/first/index.json");
  await second.engine.load("/live2d/model/second/index.json");
  expect(sdk.setGL).toHaveBeenNthCalledWith(1, first.gl, expect.any(Number));
  expect(sdk.setGL).toHaveBeenNthCalledWith(2, second.gl, expect.any(Number));
  const firstIndex = sdk.setGL.mock.calls[0]![1]!;
  const secondIndex = sdk.setGL.mock.calls[1]![1]!;
  expect(firstIndex).not.toBe(secondIndex);
  expect(loadModel).toHaveBeenNthCalledWith(1, expect.any(ArrayBuffer), firstIndex);
  expect(loadModel).toHaveBeenNthCalledWith(2, expect.any(ArrayBuffer), secondIndex);

  const mask = {};
  const framebuffer = {};
  const renderbuffer = {};
  masks[firstIndex] = mask;
  buffers[firstIndex] = { framebuffer, renderbuffer };
  first.engine.destroy();
  expect(first.gl.deleteTexture).toHaveBeenCalledWith(mask);
  expect(first.gl.deleteFramebuffer).toHaveBeenCalledWith(framebuffer);
  expect(first.gl.deleteRenderbuffer).toHaveBeenCalledWith(renderbuffer);
  expect(contexts[firstIndex]).toBeUndefined();
  expect(masks[firstIndex]).toBeUndefined();
  expect(buffers[firstIndex]).toBeUndefined();
  expect(contexts[secondIndex]).toBe(second.gl);
  second.engine.destroy();
});
