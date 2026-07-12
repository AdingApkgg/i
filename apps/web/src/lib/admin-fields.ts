/**
 * UI field registry for the config-driven /dash admin. Each domain maps to a
 * tRPC router key (same as server/root.ts) + a field list the generic editor
 * renders, and the columns the list table shows. Field types drive the control.
 */
export type FieldType = "text" | "textarea" | "number" | "boolean" | "select" | "image";

export interface FieldSpec {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

export interface AdminDomain {
  /** tRPC router key + url segment. */
  key: string;
  label: string;
  fields: FieldSpec[];
  columns: string[];
}

const rating: FieldSpec = { name: "rating", label: "评分", type: "number", placeholder: "0–10" };
const cover: FieldSpec = { name: "coverUrl", label: "封面链接", type: "text", placeholder: "https://…" };
const link: FieldSpec = { name: "link", label: "外链", type: "text", placeholder: "https://…" };
const note: FieldSpec = { name: "note", label: "备注", type: "textarea", placeholder: "可选…" };
const sortOrder: FieldSpec = { name: "sortOrder", label: "排序", type: "number", placeholder: "0" };

export const ADMIN_FIELDS: Record<string, AdminDomain> = {
  blog: {
    key: "blog",
    label: "博客",
    columns: ["title", "status"],
    fields: [
      { name: "slug", label: "Slug", type: "text", required: true, placeholder: "hello-world" },
      { name: "title", label: "标题", type: "text", required: true },
      { name: "excerpt", label: "摘要", type: "textarea" },
      { name: "contentMd", label: "正文 (Markdown)", type: "textarea", required: true },
      cover,
      { name: "status", label: "状态", type: "select", required: true, options: ["draft", "published"] },
    ],
  },
  music: {
    key: "music",
    label: "音乐",
    columns: ["title", "artist", "status"],
    fields: [
      { name: "title", label: "标题", type: "text", required: true },
      { name: "artist", label: "艺术家", type: "text" },
      { name: "album", label: "专辑", type: "text" },
      { name: "status", label: "状态", type: "select", required: true, options: ["在听", "听过", "想听"] },
      rating,
      cover,
      link,
      note,
      sortOrder,
    ],
  },
  maimai: {
    key: "maimai",
    label: "舞萌",
    columns: ["songTitle", "difficulty", "achievement"],
    fields: [
      { name: "songTitle", label: "曲名", type: "text", required: true },
      { name: "difficulty", label: "难度", type: "select", required: true, options: ["BASIC", "ADVANCED", "EXPERT", "MASTER", "RE:MASTER"] },
      { name: "level", label: "定数", type: "text", placeholder: "14+" },
      { name: "achievement", label: "达成率", type: "number", placeholder: "100.5000" },
      { name: "rank", label: "评级", type: "text", placeholder: "SSS+" },
      { name: "comboFlag", label: "Combo", type: "text", placeholder: "AP / FC" },
      { name: "syncFlag", label: "Sync", type: "text", placeholder: "FDX" },
      cover,
      note,
      sortOrder,
    ],
  },
  movie: {
    key: "movie",
    label: "影视",
    columns: ["title", "category", "status"],
    fields: [
      { name: "title", label: "标题", type: "text", required: true },
      { name: "category", label: "分类", type: "text", placeholder: "电影 / 剧集…" },
      { name: "status", label: "状态", type: "select", required: true, options: ["在看", "看过", "想看"] },
      rating,
      { name: "year", label: "年份", type: "number", placeholder: "2024" },
      cover,
      link,
      note,
      sortOrder,
    ],
  },
  vn: {
    key: "vn",
    label: "视觉小说",
    columns: ["title", "brand", "status"],
    fields: [
      { name: "title", label: "标题", type: "text", required: true },
      { name: "brand", label: "品牌", type: "text" },
      { name: "status", label: "状态", type: "select", required: true, options: ["在玩", "通关", "想玩", "搁置"] },
      rating,
      { name: "playHours", label: "游玩时长(h)", type: "number" },
      cover,
      link,
      note,
      sortOrder,
    ],
  },
  touhou: {
    key: "touhou",
    label: "东方",
    columns: ["title", "category"],
    fields: [
      { name: "title", label: "标题", type: "text", required: true },
      { name: "category", label: "分类", type: "select", options: ["game", "music", "print", "doujin"] },
      { name: "status", label: "状态", type: "text", placeholder: "收藏 / 通关…" },
      rating,
      cover,
      link,
      note,
      sortOrder,
    ],
  },
  device: {
    key: "device",
    label: "设备",
    columns: ["name", "category", "status"],
    fields: [
      { name: "name", label: "名称", type: "text", required: true },
      { name: "category", label: "分类", type: "text", placeholder: "手机 / 电脑…" },
      { name: "spec", label: "规格", type: "text" },
      { name: "status", label: "状态", type: "select", required: true, options: ["在用", "退役", "想要"] },
      { name: "acquired", label: "入手日期", type: "text", placeholder: "2024-01-01" },
      link,
      note,
      sortOrder,
    ],
  },
  gallery: {
    key: "gallery",
    label: "相册",
    columns: ["title", "takenAt"],
    fields: [
      { name: "title", label: "标题", type: "text", required: true },
      { name: "imageUrl", label: "图片链接", type: "image", required: true, placeholder: "https://…" },
      { name: "thumbUrl", label: "缩略图链接", type: "text", placeholder: "https://…" },
      { name: "description", label: "描述", type: "textarea" },
      { name: "takenAt", label: "拍摄时间", type: "text", placeholder: "2024-01-01" },
      sortOrder,
    ],
  },
  moments: {
    key: "moments",
    label: "说说",
    columns: ["content", "mood"],
    fields: [
      { name: "content", label: "内容", type: "textarea", required: true, placeholder: "此刻在想…" },
      { name: "mood", label: "心情", type: "text", placeholder: "开心 / emo…" },
    ],
  },
  friends: {
    key: "friends",
    label: "友链",
    columns: ["name", "url"],
    fields: [
      { name: "name", label: "名称", type: "text", required: true },
      { name: "url", label: "链接", type: "text", required: true, placeholder: "https://…" },
      { name: "avatarUrl", label: "头像链接", type: "text", placeholder: "https://…" },
      { name: "description", label: "描述", type: "textarea" },
      { name: "status", label: "状态", type: "select", options: ["active", "pending"] },
      sortOrder,
    ],
  },
  monitor: {
    key: "monitor",
    label: "监控",
    columns: ["name", "target", "kind"],
    fields: [
      { name: "name", label: "名称", type: "text", required: true },
      { name: "target", label: "目标", type: "text", required: true, placeholder: "https://… 或 host:port" },
      { name: "kind", label: "类型", type: "select", options: ["http", "tcp"] },
      { name: "intervalSec", label: "间隔(秒)", type: "number", placeholder: "60" },
      { name: "enabled", label: "启用", type: "boolean" },
    ],
  },
};

export const ADMIN_ORDER = [
  "blog", "moments", "gallery", "music", "movie", "vn", "maimai", "touhou", "device", "friends", "monitor",
];
