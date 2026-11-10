import { describe, expect, it } from "vitest";
import { checkWebGpu, type GpuLike } from "./webgpu-gate";

function gpuReturning(adapter: unknown): GpuLike {
  return { requestAdapter: async () => adapter as never };
}

describe("checkWebGpu", () => {
  it("没有 navigator.gpu 时判为 no-api", async () => {
    await expect(checkWebGpu(undefined)).resolves.toEqual({ ok: false, reason: "no-api" });
  });

  it("拿不到适配器时判为 no-adapter", async () => {
    await expect(checkWebGpu(gpuReturning(null))).resolves.toEqual({
      ok: false,
      reason: "no-adapter",
    });
  });

  it("软件适配器（SwiftShader 一类）判为 software", async () => {
    await expect(checkWebGpu(gpuReturning({ info: { isFallbackAdapter: true } }))).resolves.toEqual(
      {
        ok: false,
        reason: "software",
      },
    );
  });

  it("requestAdapter 抛错时判为 error，不把异常抛给调用方", async () => {
    const gpu: GpuLike = {
      requestAdapter: async () => {
        throw new Error("gpu process crashed");
      },
    };
    await expect(checkWebGpu(gpu)).resolves.toEqual({ ok: false, reason: "error" });
  });

  it("硬件适配器放行，缺少 info 字段也不拦", async () => {
    await expect(
      checkWebGpu(gpuReturning({ info: { isFallbackAdapter: false } })),
    ).resolves.toEqual({
      ok: true,
    });
    await expect(checkWebGpu(gpuReturning({}))).resolves.toEqual({ ok: true });
  });
});
