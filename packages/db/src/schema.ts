/**
 * i — personal space, v2. Drizzle schema (Postgres).
 *
 * 表 / 列 / 约束名与旧 Prisma `db push` 建出来的库逐一对齐（PascalCase 表名、
 * camelCase 列名、`Model_col_key` / `_idx` / `_fkey` 命名），切换 ORM 不需要迁移数据，
 * `drizzle-kit push` 对现有库应当无变更。改动这里的任何名字都等于改库结构。
 *
 * 约定：
 *  - 时间列 TIMESTAMP(3)，`createdAt` 默认 CURRENT_TIMESTAMP；
 *    `updatedAt` 没有库级默认（同 Prisma @updatedAt），由 $defaultFn/$onUpdate 在应用层写
 *  - 业务表主键是应用层生成的 cuid（同 Prisma @default(cuid())）；auth 表由 better-auth 生成
 */

import { createId } from "@paralleldrive/cuid2";
import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { BangumiMetadata, BangumiState } from "./bangumi-types";

/** 富文本正文：Tiptap / ProseMirror 文档 JSON（schema 见 apps/web/src/lib/content） */
export type RichDocJson = { type: "doc"; content?: unknown[] };

const ts = (name: string) => timestamp(name, { precision: 3, mode: "date" });

const id = () => text("id").primaryKey().$defaultFn(createId);
const createdAt = () => ts("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`);
const updatedAt = () =>
  ts("updatedAt")
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date());

// ==================== Auth (better-auth) ====================

export const user = pgTable(
  "User",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    emailVerified: boolean("emailVerified").notNull().default(false),
    name: text("name"),
    image: text("image"),
    role: text("role").notNull().default("user"), // "user" | "admin" | "owner"
    banned: boolean("banned").notNull().default(false),
    banReason: text("banReason"),
    banExpiresAt: ts("banExpiresAt"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("User_email_key").on(t.email), index("User_email_idx").on(t.email)],
);

export const session = pgTable(
  "Session",
  {
    id: text("id").primaryKey(),
    expiresAt: ts("expiresAt").notNull(),
    token: text("token").notNull(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("Session_token_key").on(t.token),
    index("Session_userId_idx").on(t.userId),
    foreignKey({ name: "Session_userId_fkey", columns: [t.userId], foreignColumns: [user.id] })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ],
);

export const account = pgTable(
  "Account",
  {
    id: text("id").primaryKey(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId").notNull(),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: ts("accessTokenExpiresAt"),
    refreshTokenExpiresAt: ts("refreshTokenExpiresAt"),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("Account_userId_idx").on(t.userId),
    uniqueIndex("Account_providerId_accountId_key").on(t.providerId, t.accountId),
    foreignKey({ name: "Account_userId_fkey", columns: [t.userId], foreignColumns: [user.id] })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ],
);

export const verification = pgTable(
  "Verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: ts("expiresAt").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("Verification_identifier_idx").on(t.identifier)],
);

// ==================== Blog ====================

export const post = pgTable(
  "Post",
  {
    id: id(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    // 旧 Hexo Markdown，迁移到 content 后只作备份，确认无误后删除
    contentMd: text("contentMd"),
    content: jsonb("content").$type<RichDocJson>(),
    coverUrl: text("coverUrl"),
    // 可空数组（沿用 Prisma 建的列）。默认值放应用层：drizzle-kit 0.31 内省数组默认值有 bug
    // （`ARRAY[]::text[]` / `'{}'` 都会被判为有差异），放库里会导致每次 push 都重设一遍
    tags: text("tags")
      .array()
      .$defaultFn(() => []),
    status: text("status").notNull().default("draft"), // "draft" | "published"
    publishedAt: ts("publishedAt"),
    views: integer("views").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("Post_slug_key").on(t.slug),
    index("Post_status_publishedAt_idx").on(t.status, t.publishedAt),
  ],
);

// ==================== Comments (self-hosted, visitor identity) ====================

export const comment = pgTable(
  "Comment",
  {
    id: id(),
    // 通用挂载点：页面 path（博客、相册等都能挂评论）；博客评论额外记 postId
    path: text("path").notNull(),
    contentMd: text("contentMd").notNull(),
    status: text("status").notNull().default("visible"), // visible | pending | spam | deleted
    userId: text("userId").notNull(),
    postId: text("postId"),
    parentId: text("parentId"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("Comment_path_createdAt_idx").on(t.path, t.createdAt),
    index("Comment_postId_idx").on(t.postId),
    foreignKey({ name: "Comment_userId_fkey", columns: [t.userId], foreignColumns: [user.id] })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({ name: "Comment_postId_fkey", columns: [t.postId], foreignColumns: [post.id] })
      .onDelete("cascade")
      .onUpdate("cascade"),
    foreignKey({ name: "Comment_parentId_fkey", columns: [t.parentId], foreignColumns: [t.id] })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ],
);

// ==================== 音乐 / 影视 / 视觉小说 / 东方 / 设备 ====================

export const track = pgTable(
  "Track",
  {
    id: id(),
    title: text("title").notNull(),
    artist: text("artist"),
    album: text("album"),
    status: text("status").notNull().default("在听"), // 在听 | 听过 | 想听
    rating: integer("rating"),
    coverUrl: text("coverUrl"),
    link: text("link"),
    note: text("note"),
    sortOrder: integer("sortOrder").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("Track_status_createdAt_idx").on(t.status, t.createdAt)],
);

export const movie = pgTable(
  "Movie",
  {
    id: id(),
    title: text("title").notNull(),
    category: text("category"), // 电影 / 剧集…
    status: text("status").notNull().default("在看"), // 在看 | 看过 | 想看
    rating: integer("rating"),
    year: integer("year"),
    coverUrl: text("coverUrl"),
    link: text("link"),
    note: text("note"),
    sortOrder: integer("sortOrder").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("Movie_status_createdAt_idx").on(t.status, t.createdAt)],
);

export const vn = pgTable(
  "Vn",
  {
    id: id(),
    title: text("title").notNull(),
    brand: text("brand"),
    vndbId: text("vndbId"),
    released: text("released"),
    vndbRating: doublePrecision("vndbRating"),
    descriptionOriginal: text("descriptionOriginal"),
    descriptionZh: text("descriptionZh"),
    status: text("status").notNull().default("在玩"), // 在玩 | 通关 | 想玩 | 搁置
    rating: integer("rating"),
    playHours: integer("playHours"),
    coverUrl: text("coverUrl"),
    link: text("link"),
    note: text("note"),
    sortOrder: integer("sortOrder").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("Vn_status_createdAt_idx").on(t.status, t.createdAt),
    uniqueIndex("Vn_vndbId_key").on(t.vndbId),
  ],
);

export const touhou = pgTable(
  "Touhou",
  {
    id: id(),
    title: text("title").notNull(),
    category: text("category"), // game | music | print | doujin
    status: text("status").notNull().default("收藏"),
    rating: integer("rating"),
    coverUrl: text("coverUrl"),
    link: text("link"),
    note: text("note"),
    sortOrder: integer("sortOrder").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("Touhou_category_createdAt_idx").on(t.category, t.createdAt)],
);

export const device = pgTable(
  "Device",
  {
    id: id(),
    name: text("name").notNull(),
    category: text("category"), // 手机 / 电脑…
    spec: text("spec"),
    imageUrl: text("imageUrl"),
    status: text("status").notNull().default("在用"), // 在用 | 退役 | 想要
    acquired: text("acquired"), // 入手日期（自由文本）
    link: text("link"),
    note: text("note"),
    sortOrder: integer("sortOrder").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("Device_status_createdAt_idx").on(t.status, t.createdAt)],
);

// ==================== 相册 (gallery) ====================

export const album = pgTable(
  "Album",
  {
    id: id(),
    name: text("name").notNull(),
    description: text("description"),
    coverUrl: text("coverUrl"), // 不填则前台取图集第一张
    sortOrder: integer("sortOrder").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("Album_name_key").on(t.name),
    index("Album_sortOrder_createdAt_idx").on(t.sortOrder, t.createdAt),
  ],
);

export const photo = pgTable(
  "Photo",
  {
    id: id(),
    title: text("title").notNull().default(""), // 单张图标题，可空串
    imageUrl: text("imageUrl").notNull(),
    thumbUrl: text("thumbUrl"),
    description: text("description"),
    takenAt: text("takenAt"),
    sortOrder: integer("sortOrder").notNull().default(0),
    albumId: text("albumId"), // null = 未分类
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("Photo_createdAt_idx").on(t.createdAt),
    index("Photo_albumId_idx").on(t.albumId),
    foreignKey({ name: "Photo_albumId_fkey", columns: [t.albumId], foreignColumns: [album.id] })
      .onDelete("set null")
      .onUpdate("cascade"),
  ],
);

// ==================== 富文本页 (curated pages: 音乐/影视 imported) ====================

export const page = pgTable("Page", {
  id: text("id").primaryKey(), // "music" | "movie" | ...
  title: text("title").notNull(),
  // 旧 Hexo Markdown，迁移到 content 后只作备份，确认无误后删除
  contentMd: text("contentMd"),
  content: jsonb("content").$type<RichDocJson>(),
  updatedAt: updatedAt(),
});

// ==================== 说说 (moments) ====================

export const moment = pgTable(
  "Moment",
  {
    id: id(),
    content: text("content").notNull(),
    mood: text("mood"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("Moment_createdAt_idx").on(t.createdAt)],
);

// ==================== 友链 (friends) ====================

// MX Space 式友链：自助申请(pending) → 审核(active/rejected)，定时存活检测
// 失联标记 outdate，反链检测结果仅供后台审核参考。
export const friend = pgTable(
  "Friend",
  {
    id: id(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    avatarUrl: text("avatarUrl"),
    description: text("description"),
    group: text("group"), // 分组（旧站 link.yml 的 class_name；申请默认进「朋友」）
    status: text("status").notNull().default("active"), // active | pending | rejected | outdate
    // -- 申请信息（不对外暴露）--
    email: text("email"), // 申请人邮箱，审核结果通知用
    message: text("message"), // 申请留言，仅后台可见
    applicantId: text("applicantId"), // 登录用户申请时记录 user id
    // -- 检测状态 --
    reachable: boolean("reachable"), // 最近一次存活探测结果
    backlinked: boolean("backlinked"), // 对方页面是否挂了本站链接（反链）
    failCount: integer("failCount").notNull().default(0), // 连续失败次数，≥3 时 active → outdate
    checkedAt: ts("checkedAt"), // 最近检测时间
    sortOrder: integer("sortOrder").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("Friend_status_sortOrder_idx").on(t.status, t.sortOrder)],
);

// ==================== 监控 (monitor) ====================

export const monitor = pgTable(
  "Monitor",
  {
    id: id(),
    name: text("name").notNull(),
    target: text("target").notNull(), // https://… or host:port
    kind: text("kind").notNull().default("http"), // http | tcp
    intervalSec: integer("intervalSec").notNull().default(60),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("Monitor_enabled_kind_idx").on(t.enabled, t.kind)],
);

export const monitorCheck = pgTable(
  "MonitorCheck",
  {
    id: id(),
    monitorId: text("monitorId").notNull(),
    ok: boolean("ok").notNull(),
    statusCode: integer("statusCode"),
    latencyMs: integer("latencyMs"),
    checkedAt: ts("checkedAt").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("MonitorCheck_monitorId_checkedAt_idx").on(t.monitorId, t.checkedAt),
    foreignKey({
      name: "MonitorCheck_monitorId_fkey",
      columns: [t.monitorId],
      foreignColumns: [monitor.id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
  ],
);

// ==================== 舞萌 maimaiDX — 查分器对接 (maimai) ====================
// 成绩从 水鱼(diving-fish) / 落雪(lxns) 同步：单行配置 + 单行档案 + 成绩表（b50 ∪ 全部成绩）。

export const maimaiConfig = pgTable("MaimaiConfig", {
  id: text("id").primaryKey().default("current"),
  source: text("source").notNull().default("diving-fish"), // "diving-fish" | "lxns"
  divingFishUsername: text("divingFishUsername"),
  divingFishImportToken: text("divingFishImportToken"),
  lxnsPersonalToken: text("lxnsPersonalToken"),
  updatedAt: updatedAt(),
});

export const maimaiProfile = pgTable("MaimaiProfile", {
  id: text("id").primaryKey().default("current"),
  source: text("source").notNull(),
  nickname: text("nickname").notNull(),
  rating: integer("rating").notNull().default(0),
  updatedAt: updatedAt(),
});

export const maimaiRecord = pgTable(
  "MaimaiRecord",
  {
    id: id(),
    source: text("source").notNull(), // "diving-fish" | "lxns"
    songId: integer("songId").notNull(),
    title: text("title").notNull(),
    type: text("type").notNull(), // "standard" | "dx"
    levelIndex: integer("levelIndex").notNull(), // 0 Basic .. 4 Re:MASTER
    levelLabel: text("levelLabel").notNull(), // 显示用等级，如 "14+"
    ds: doublePrecision("ds"), // 定数
    achievements: doublePrecision("achievements").notNull().default(0),
    dxScore: integer("dxScore").notNull().default(0),
    ra: integer("ra").notNull().default(0), // 单曲 rating
    fc: text("fc"), // "" | fc | fcp | ap | app
    fs: text("fs"), // "" | fs | fsp | fsd | fsdp | sync
    rate: text("rate"), // sssp | sss | ...
    coverUrl: text("coverUrl"),
    pool: text("pool"), // "b35" | "b15" | null（null = 只在全部成绩里）
    boardOrder: integer("boardOrder").notNull().default(0), // b50 池内顺序
    syncedAt: ts("syncedAt").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("MaimaiRecord_pool_boardOrder_idx").on(t.pool, t.boardOrder),
    index("MaimaiRecord_achievements_idx").on(t.achievements),
    uniqueIndex("MaimaiRecord_songId_type_levelIndex_key").on(t.songId, t.type, t.levelIndex),
  ],
);

// ==================== relations（db.query 的 with 用） ====================

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  comments: many(comment),
}));
export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, { fields: [session.userId], references: [user.id] }),
}));
export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, { fields: [account.userId], references: [user.id] }),
}));
export const postRelations = relations(post, ({ many }) => ({ comments: many(comment) }));
export const commentRelations = relations(comment, ({ one }) => ({
  user: one(user, { fields: [comment.userId], references: [user.id] }),
  post: one(post, { fields: [comment.postId], references: [post.id] }),
}));
export const albumRelations = relations(album, ({ many }) => ({ photos: many(photo) }));
export const photoRelations = relations(photo, ({ one }) => ({
  album: one(album, { fields: [photo.albumId], references: [album.id] }),
}));
export const monitorRelations = relations(monitor, ({ many }) => ({
  checks: many(monitorCheck),
}));
export const monitorCheckRelations = relations(monitorCheck, ({ one }) => ({
  monitor: one(monitor, { fields: [monitorCheck.monitorId], references: [monitor.id] }),
}));

// ==================== row types ====================

export type User = typeof user.$inferSelect;
export type Session = typeof session.$inferSelect;
export type Post = typeof post.$inferSelect;
export type Comment = typeof comment.$inferSelect;
export type Track = typeof track.$inferSelect;
export type Movie = typeof movie.$inferSelect;
export type Vn = typeof vn.$inferSelect;
export type Touhou = typeof touhou.$inferSelect;
export type Device = typeof device.$inferSelect;
export type Album = typeof album.$inferSelect;
export type Photo = typeof photo.$inferSelect;
export type Page = typeof page.$inferSelect;
export type Moment = typeof moment.$inferSelect;
export type Friend = typeof friend.$inferSelect;
export type Monitor = typeof monitor.$inferSelect;
export type MonitorCheck = typeof monitorCheck.$inferSelect;
export type MaimaiConfig = typeof maimaiConfig.$inferSelect;
export type MaimaiProfile = typeof maimaiProfile.$inferSelect;
export type MaimaiRecord = typeof maimaiRecord.$inferSelect;

// ==================== Bangumi 单账号追番同步 ====================

export const bangumiAccount = pgTable("BangumiAccount", {
  id: text("id").primaryKey(),
  userId: integer("userId"),
  username: text("username").notNull().default(""),
  initialized: boolean("initialized").notNull().default(false),
  autoSync: boolean("autoSync").notNull().default(false),
  activeRunId: text("activeRunId"),
  activeSince: ts("activeSince"),
  lastAttemptAt: ts("lastAttemptAt"),
  lastSyncedAt: ts("lastSyncedAt"),
  lastError: text("lastError"),
  updatedAt: updatedAt(),
});
export const bangumiEntry = pgTable("BangumiEntry", {
  subjectId: integer("subjectId").primaryKey(),
  metadata: jsonb("metadata").$type<BangumiMetadata>().notNull(),
  state: jsonb("state").$type<BangumiState>().notNull(),
  baseline: jsonb("baseline").$type<BangumiState>(),
  lastRemote: jsonb("lastRemote").$type<BangumiState>(),
  revision: integer("revision").notNull().default(0),
  syncStatus: text("syncStatus").notNull().default("pending"),
  syncError: text("syncError"),
  conflicts: jsonb("conflicts").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  writeUncertain: boolean("writeUncertain").notNull().default(false),
  paused: boolean("paused").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});
export const bangumiRun = pgTable("BangumiRun", {
  id: id(),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("running"),
  progress: text("progress").notNull().default("准备连接 Bangumi"),
  data: jsonb("data").$type<unknown>(),
  error: text("error"),
  createdAt: createdAt(),
  expiresAt: ts("expiresAt").notNull(),
  finishedAt: ts("finishedAt"),
});

// 私有服务配置：不得通过公共 CRUD 暴露；密钥使用服务端认证 secret 加密。
export const aiTranslation = pgTable("AiTranslation", {
  id: text("id").primaryKey(),
  baseUrl: text("baseUrl").notNull(),
  model: text("model").notNull(),
  encryptedApiKey: text("encryptedApiKey"),
  enabled: boolean("enabled").notNull().default(false),
  updatedAt: updatedAt(),
});

// 按用户要求公开的每日记录；写入仅管理员，日期唯一。
export const masturbationDay = pgTable(
  "MasturbationDay",
  {
    date: date("date", { mode: "string" }).primaryKey(),
    count: integer("count").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check("MasturbationDay_count_check", sql`${t.count} > 0 AND ${t.count} <= 1000`)],
);
