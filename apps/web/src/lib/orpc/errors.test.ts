import { ORPCError } from "@orpc/client";
import { describe, expect, it } from "vitest";
import { orpcErrText, orpcFieldErrors } from "./errors";

const validation = (path: unknown[]) =>
  new ORPCError("BAD_REQUEST", {
    message: "Input validation failed",
    data: { issues: [{ message: "Invalid", path }] },
  });

describe("orpcErrText", () => {
  it("校验失败：按第一个字段取自定义提示", () => {
    expect(orpcErrText(validation(["email"]), "失败", { email: "邮箱格式不对" })).toBe(
      "邮箱格式不对",
    );
  });

  it("校验失败：path 段为 { key } 形式也能识别", () => {
    expect(orpcErrText(validation([{ key: "url" }]), "失败", { url: "链接不对" })).toBe("链接不对");
  });

  it("校验失败：没有映射的字段给出通用提示", () => {
    expect(orpcErrText(validation(["name"]), "失败")).toBe("「name」格式不对，检查一下～");
  });

  it("校验失败：共用 schema 的中文文案直接用", () => {
    const e = new ORPCError("BAD_REQUEST", {
      message: "Input validation failed",
      data: { issues: [{ message: "头像链接格式不对～", path: ["avatarUrl"] }] },
    });
    expect(orpcErrText(e, "失败")).toBe("头像链接格式不对～");
    expect(orpcFieldErrors(e)).toEqual([{ field: "avatarUrl", message: "头像链接格式不对～" }]);
  });

  it("orpcFieldErrors：逐字段、同字段只取第一条，非校验错误为空", () => {
    const e = new ORPCError("BAD_REQUEST", {
      data: {
        issues: [
          { message: "名称不能为空", path: ["name"] },
          { message: "Too long", path: ["name"] },
          { message: "Invalid", path: ["url"] },
        ],
      },
    });
    expect(orpcFieldErrors(e, { url: "链接不对" })).toEqual([
      { field: "name", message: "名称不能为空" },
      { field: "url", message: "链接不对" },
    ]);
    expect(orpcFieldErrors(new ORPCError("CONFLICT"))).toEqual([]);
    expect(orpcFieldErrors(new Error("x"))).toEqual([]);
  });

  it("业务错误的自定义 message 原样展示", () => {
    const e = new ORPCError("CONFLICT", { message: "已存在同名记录" });
    expect(orpcErrText(e, "失败")).toBe("已存在同名记录");
  });

  it("默认英文 message 换成中文", () => {
    expect(orpcErrText(new ORPCError("UNAUTHORIZED"), "失败")).toBe("请先登录");
    expect(orpcErrText(new ORPCError("FORBIDDEN"), "失败")).toBe("没有权限");
  });

  it("没有中文映射的默认错误走 fallback", () => {
    expect(orpcErrText(new ORPCError("INTERNAL_SERVER_ERROR"), "保存失败")).toBe("保存失败");
  });

  it("非 oRPC 错误（如断网）走 fallback", () => {
    expect(orpcErrText(new TypeError("Failed to fetch"), "提交失败")).toBe("提交失败");
    expect(orpcErrText("boom", "提交失败")).toBe("提交失败");
  });
});
