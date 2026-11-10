/**
 * 站点的硬性门槛：必须能拿到真正的 WebGPU 硬件适配器。
 *
 * 本站首屏的浮空城与看板娘都走 WebGPU 实时渲染，没有可用的硬件通道时不做任何降级，
 * 直接拦下并让访客换平台或浏览器（2026-11 决定，见 docs/asuna-design.md）。
 * 软件适配器（SwiftShader / llvmpipe 等）不算通过：它们能建出设备，但帧率和功耗不可接受，
 * 无头机上的原生错误域异常也主要来自它们。
 */

/** 拦截原因，用来选文案；新增原因记得同时补组件里的文案表。 */
export type GateReason = "no-api" | "no-adapter" | "software" | "error";

export type GateVerdict = { ok: true } | { ok: false; reason: GateReason };

/** 只声明用得到的部分，避免为了一个字段引入整套 WebGPU 类型。 */
export type AdapterLike = { info?: { isFallbackAdapter?: boolean } };
export type GpuLike = { requestAdapter(options?: unknown): Promise<AdapterLike | null> };

/**
 * 判定当前环境能否进站。
 * `gpu` 可注入，方便单元测试在 Node 环境里覆盖各条分支。
 */
export async function checkWebGpu(gpu: GpuLike | undefined = currentGpu()): Promise<GateVerdict> {
  if (!gpu) return { ok: false, reason: "no-api" };
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) return { ok: false, reason: "no-adapter" };
    if (adapter.info?.isFallbackAdapter) return { ok: false, reason: "software" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "error" };
  }
}

function currentGpu(): GpuLike | undefined {
  return (globalThis.navigator as (Navigator & { gpu?: GpuLike }) | undefined)?.gpu;
}
