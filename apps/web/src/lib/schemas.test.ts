import { describe, expect, it } from "vitest";
import {
  changePasswordSchema,
  friendApplySchema,
  friendWriteSchema,
  maimaiConfigSchema,
  signUpSchema,
} from "./schemas";

const firstMessage = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.error?.issues[0]?.message;

describe("友链申请", () => {
  const base = { name: " 小站 ", url: "example.org", email: "a@b.cc" };

  it("补协议头、去空白、空字段统一成 null", () => {
    expect(friendApplySchema.parse({ ...base, avatarUrl: "", description: "  " })).toEqual({
      name: "小站",
      url: "https://example.org",
      avatarUrl: null,
      description: null,
      email: "a@b.cc",
      message: null,
    });
  });

  it("中文报错：头像链接 / 非 http 协议 / 邮箱", () => {
    expect(firstMessage(friendApplySchema.safeParse({ ...base, avatarUrl: "not a url" }))).toBe(
      "头像链接格式不对～",
    );
    expect(firstMessage(friendApplySchema.safeParse({ ...base, url: "ftp://x.org" }))).toBe(
      "链接格式不对，要以 http(s):// 开头～",
    );
    expect(firstMessage(friendApplySchema.safeParse({ ...base, email: "nope" }))).toBe(
      "邮箱格式不对，检查一下～",
    );
    expect(firstMessage(friendApplySchema.safeParse({ ...base, name: "" }))).toBe(
      "站点名称不能为空",
    );
  });

  it("校验后的输出再校验一遍结果不变（表单校验完直接发给接口）", () => {
    const once = friendApplySchema.parse({ ...base, avatarUrl: "https://a.cc/x.png" });
    expect(friendApplySchema.parse(once)).toEqual(once);
    const admin = friendWriteSchema.parse({ name: "x", url: "x.org", sortOrder: 3 });
    expect(friendWriteSchema.parse(admin)).toEqual(admin);
  });

  it("后台表单：排序清空（NaN）给出中文提示", () => {
    expect(
      firstMessage(friendWriteSchema.safeParse({ name: "x", url: "x.org", sortOrder: Number.NaN })),
    ).toBe("排序要填整数");
  });
});

describe("账号", () => {
  it("注册密码至少 6 位、邮箱格式", () => {
    expect(
      firstMessage(signUpSchema.safeParse({ name: "", email: "a@b.cc", password: "123" })),
    ).toBe("密码至少 6 位");
    expect(firstMessage(signUpSchema.safeParse({ name: "", email: "x", password: "123456" }))).toBe(
      "邮箱格式不对，检查一下～",
    );
  });

  it("新密码不能和当前密码一样（错误挂在新密码上）", () => {
    const r = changePasswordSchema.safeParse({ currentPassword: "abcdef", newPassword: "abcdef" });
    expect(r.error?.issues[0]).toMatchObject({
      path: ["newPassword"],
      message: "新密码和当前密码一样",
    });
  });
});

describe("舞萌查分器配置", () => {
  it("只要求当前数据源的凭据", () => {
    expect(firstMessage(maimaiConfigSchema.safeParse({ source: "diving-fish" }))).toBe(
      "填一下水鱼用户名",
    );
    expect(firstMessage(maimaiConfigSchema.safeParse({ source: "lxns" }))).toBe(
      "填一下落雪 API 密钥",
    );
    expect(maimaiConfigSchema.safeParse({ source: "lxns", lxnsPersonalToken: "t" }).success).toBe(
      true,
    );
  });
});
