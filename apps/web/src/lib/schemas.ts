/**
 * 前后端共用的输入校验（zod）。oRPC 接口的 input 和前端表单（react-hook-form + zodResolver）
 * 用同一份规则、同一套中文报错：前端提交前就地提示，服务端兜底校验失败时也能把同样的文案挂回对应字段。
 *
 * 约定：可空字段的输出统一是 null（"" / 空白 / 缺省都算没填），且「输出再校验一遍结果不变」，
 * 这样表单校验后的值直接发给接口，服务端用同一个 schema 再解析也不会出错。
 */
import { z } from "zod";

// ---------------- 字段积木 ----------------

const tooLong = (label: string, max: number) => `${label}太长啦（${max} 字以内）`;

/** 只认 http(s) 的链接 */
const httpUrl = (message: string) =>
  z.url({ protocol: /^https?$/, message }).max(300, "链接太长啦（300 字以内）");

/** 少打协议头是常态：没写协议时补上 https://（写了别的协议如 ftp:// 则保留，交给校验拒绝） */
const withProtocol = (v: string) => (/^[a-z][a-z\d+.-]*:\/\//i.test(v) ? v : `https://${v}`);

/** 必填文本 */
export const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `${label}不能为空`).max(max, tooLong(label, max));

/** 可空文本 → string | null */
export const nullableText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, tooLong(label, max))
    .nullish()
    .transform((v) => v || null);

/** 必填站点链接：自动补 https:// */
export const siteUrl = (message: string) =>
  z.string().trim().min(1, "链接不能为空").transform(withProtocol).pipe(httpUrl(message));

/** 可空链接（头像等，不补协议头）→ string | null */
export const nullableUrl = (message: string) =>
  z
    .string()
    .trim()
    .nullish()
    .transform((v) => v || null)
    .pipe(httpUrl(message).nullable());

/** 可空邮箱 → string | null */
export const nullableEmail = () =>
  z
    .string()
    .trim()
    .nullish()
    .transform((v) => v || null)
    .pipe(z.email("邮箱格式不对，检查一下～").max(100, tooLong("邮箱", 100)).nullable());

// ---------------- 友链 ----------------

export const FRIEND_STATUSES = ["active", "pending", "rejected", "outdate"] as const;

/** 访客自助申请 */
export const friendApplySchema = z.object({
  name: requiredText("站点名称", 50),
  url: siteUrl("链接格式不对，要以 http(s):// 开头～"),
  avatarUrl: nullableUrl("头像链接格式不对～"),
  description: nullableText("描述", 200),
  email: nullableEmail(),
  message: nullableText("留言", 500),
});

/** 后台新建 / 编辑 */
export const friendWriteSchema = z.object({
  name: requiredText("名称", 50),
  url: siteUrl("链接格式不对，要以 http(s):// 开头"),
  avatarUrl: nullableUrl("头像链接格式不对"),
  description: nullableText("描述", 200),
  group: nullableText("分组", 30),
  status: z.enum(FRIEND_STATUSES).default("active"),
  email: nullableEmail(),
  sortOrder: z.number("排序要填整数").int("排序要填整数").default(0),
});

// ---------------- 评论 ----------------

export const commentBodySchema = z.object({
  contentMd: requiredText("评论", 2000),
});

// ---------------- 账号（better-auth） ----------------

const email = z.string().trim().min(1, "请填写邮箱").pipe(z.email("邮箱格式不对，检查一下～"));
/** 与 better-auth 的 minPasswordLength 一致 */
const newPassword = z.string().min(6, "密码至少 6 位").max(128, "密码太长啦");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "请填写密码"),
});

export const signUpSchema = z.object({
  name: z.string().trim().max(30, tooLong("昵称", 30)),
  email,
  password: newPassword,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "请填写当前密码"),
    newPassword,
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "新密码和当前密码一样",
    path: ["newPassword"],
  });

// ---------------- 舞萌查分器 ----------------

export const MAIMAI_SOURCES = ["diving-fish", "lxns"] as const;

export const maimaiConfigSchema = z
  .object({
    source: z.enum(MAIMAI_SOURCES),
    divingFishUsername: z.string().trim().max(100).optional(),
    divingFishImportToken: z.string().trim().max(500).optional(),
    lxnsPersonalToken: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    // 只要求当前数据源的凭据；另一个源的配置保留不动
    if (v.source === "diving-fish" && !v.divingFishUsername) {
      ctx.addIssue({ code: "custom", path: ["divingFishUsername"], message: "填一下水鱼用户名" });
    }
    if (v.source === "lxns" && !v.lxnsPersonalToken) {
      ctx.addIssue({ code: "custom", path: ["lxnsPersonalToken"], message: "填一下落雪 API 密钥" });
    }
  });
