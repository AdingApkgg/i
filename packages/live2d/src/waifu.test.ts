import { describe, expect, it } from "vitest";
import { groupCostumes, modelSrc, seasonGreeting, timeGreeting, type WaifuTips } from "./waifu";

describe("仓内 Live2D 模型", () => {
  it("模型入口始终走本站资源，不再请求 npm 或 CDN", () => {
    expect(modelSrc("asuna/asuna_02")).toBe("/live2d/model/asuna/asuna_02/index.json");
    expect(modelSrc("bilibili-live/22")).toBe("/live2d/model/bilibili-live/22/index.json");
  });

  it("保留组与换装顺序以兼容持久化偏好", () => {
    const list = { models: [["asuna/asuna_02", "asuna/asuna_01"], "sagiri"], messages: [] };
    expect(groupCostumes(list, 0)).toEqual(["asuna/asuna_02", "asuna/asuna_01"]);
    expect(groupCostumes(list, 1)).toEqual(["sagiri"]);
    expect(groupCostumes(list, 9)).toEqual([]);
  });
});

// 重构时保持现有问候的日期与边界语义，测试不访问网络。
describe("看板娘问候", () => {
  const tips = {
    time: [{ hour: "6-7", text: "早上好" }],
    seasons: [{ date: "11/05-11/12", text: "欢迎来到 {year}" }],
  } as WaifuTips;

  it("时段包含端点，区间外没有额外问候", () => {
    expect(timeGreeting(tips, new Date(2026, 10, 8, 7))).toBe("早上好");
    expect(timeGreeting(tips, new Date(2026, 10, 8, 8))).toBeNull();
  });

  it("节日区间保留年份替换", () => {
    expect(seasonGreeting(tips, new Date(2026, 10, 8))).toBe("欢迎来到 2026");
    expect(seasonGreeting(tips, new Date(2026, 10, 13))).toBeNull();
  });
});
