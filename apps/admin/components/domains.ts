/**
 * Config-driven domain registry for the admin CMS.
 *
 * Each domain declares its 中文 label, the API path prefix (all backend domains
 * expose GET list / POST create / PUT {id} / DELETE {id} at
 * `/api/<domain>/items`), and a field list. The generic <DomainList> and
 * <DomainEditor> render entirely from these specs, so adding/adjusting a domain
 * is a data change — no hand-written editors.
 */

export type FieldType = "text" | "textarea" | "number" | "boolean" | "select" | "image";

export interface FieldSpec {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** Options for `select` fields (the raw values stored/sent). */
  options?: string[];
  placeholder?: string;
}

export interface DomainSpec {
  /** Registry key, also used in the nav and as a stable id. */
  key: string;
  /** 中文 label shown in the nav + headings. */
  label: string;
  /** API path prefix, e.g. `/api/movie/items`. */
  prefix: string;
  /** Field config, in form/table order. First text-ish field is the title. */
  fields: FieldSpec[];
  /**
   * Columns to surface in the list table (field names). Defaults to the first
   * couple of fields when omitted. A `status` field is always rendered as a
   * Badge when present.
   */
  columns?: string[];
  /** Whether the backend supports a `?status=` filter on the list endpoint. */
  statusFilter?: boolean;
  /** monitor gets an extra live status panel. */
  hasMonitorStatus?: boolean;
}

/** Shared building blocks reused across domains. */
const ratingField: FieldSpec = { name: "rating", label: "评分", type: "number", placeholder: "0–10" };
const coverField: FieldSpec = { name: "cover_url", label: "封面链接", type: "text", placeholder: "https://…" };
const linkField: FieldSpec = { name: "link", label: "外链", type: "text", placeholder: "https://…" };
const noteField: FieldSpec = { name: "note", label: "备注", type: "textarea", placeholder: "可选备注…" };

export const DOMAINS: DomainSpec[] = [
  {
    key: "movie",
    label: "影视",
    prefix: "/api/movie/items",
    statusFilter: true,
    columns: ["title", "category", "year"],
    fields: [
      { name: "title", label: "标题", type: "text", required: true },
      { name: "category", label: "分类", type: "text", placeholder: "电影 / 剧集…" },
      { name: "status", label: "状态", type: "select", required: true, options: ["在看", "看过", "想看"] },
      ratingField,
      { name: "year", label: "年份", type: "number", placeholder: "2024" },
      coverField,
      linkField,
      noteField,
    ],
  },
  {
    key: "anime",
    label: "番剧",
    prefix: "/api/anime/items",
    statusFilter: true,
    columns: ["title", "progress"],
    fields: [
      { name: "title", label: "标题", type: "text", required: true },
      { name: "status", label: "状态", type: "select", required: true, options: ["在看", "看完", "想看", "搁置"] },
      ratingField,
      { name: "progress", label: "进度", type: "text", placeholder: "12 / 24" },
      coverField,
      linkField,
      noteField,
    ],
  },
  {
    key: "music",
    label: "音乐",
    prefix: "/api/music/items",
    statusFilter: true,
    columns: ["title", "artist", "album"],
    fields: [
      { name: "title", label: "标题", type: "text", required: true },
      { name: "artist", label: "艺术家", type: "text" },
      { name: "album", label: "专辑", type: "text" },
      { name: "status", label: "状态", type: "select", required: true, options: ["在听", "听过", "想听"] },
      ratingField,
      coverField,
      linkField,
      noteField,
    ],
  },
  {
    key: "gal",
    label: "Galgame",
    prefix: "/api/gal/items",
    statusFilter: true,
    columns: ["title", "brand", "play_hours"],
    fields: [
      { name: "title", label: "标题", type: "text", required: true },
      { name: "brand", label: "品牌", type: "text" },
      { name: "status", label: "状态", type: "select", required: true, options: ["在玩", "通关", "想玩", "搁置"] },
      ratingField,
      { name: "play_hours", label: "游玩时长(h)", type: "number", placeholder: "0" },
      coverField,
      linkField,
      noteField,
    ],
  },
  {
    key: "touhou",
    label: "东方",
    prefix: "/api/touhou/items",
    statusFilter: true,
    columns: ["title", "category"],
    fields: [
      { name: "title", label: "标题", type: "text", required: true },
      { name: "category", label: "分类", type: "select", options: ["game", "music", "print", "doujin"] },
      { name: "status", label: "状态", type: "select", required: true, options: ["在玩", "通关", "想要", "收藏"] },
      ratingField,
      coverField,
      linkField,
      noteField,
    ],
  },
  {
    key: "device",
    label: "设备",
    prefix: "/api/device/items",
    statusFilter: true,
    columns: ["name", "category", "acquired"],
    fields: [
      { name: "name", label: "名称", type: "text", required: true },
      { name: "category", label: "分类", type: "text", placeholder: "手机 / 电脑…" },
      { name: "spec", label: "规格", type: "text" },
      { name: "status", label: "状态", type: "select", required: true, options: ["在用", "退役", "想要"] },
      { name: "acquired", label: "入手日期", type: "text", placeholder: "2024-01-01" },
      linkField,
      noteField,
    ],
  },
  {
    key: "moments",
    label: "说说",
    prefix: "/api/moments/items",
    columns: ["content", "mood"],
    fields: [
      { name: "content", label: "内容", type: "textarea", required: true, placeholder: "此刻在想…" },
      { name: "mood", label: "心情", type: "text", placeholder: "开心 / emo…" },
    ],
  },
  {
    key: "gallery",
    label: "相册",
    prefix: "/api/gallery/items",
    columns: ["title", "taken_at"],
    fields: [
      { name: "title", label: "标题", type: "text", required: true },
      { name: "image_url", label: "图片", type: "image", required: true, placeholder: "上传或粘贴链接" },
      { name: "thumb_url", label: "缩略图链接", type: "text", placeholder: "https://…" },
      { name: "description", label: "描述", type: "textarea" },
      { name: "taken_at", label: "拍摄时间", type: "text", placeholder: "2024-01-01" },
    ],
  },
  {
    key: "friends",
    label: "友链",
    prefix: "/api/friends/items",
    columns: ["name", "url"],
    fields: [
      { name: "name", label: "名称", type: "text", required: true },
      { name: "url", label: "链接", type: "text", required: true, placeholder: "https://…" },
      { name: "avatar_url", label: "头像链接", type: "text", placeholder: "https://…" },
      { name: "description", label: "描述", type: "textarea" },
      { name: "status", label: "状态", type: "select", options: ["active", "pending"] },
    ],
  },
  {
    key: "monitor",
    label: "监控",
    prefix: "/api/monitor/items",
    hasMonitorStatus: true,
    columns: ["name", "target", "kind"],
    fields: [
      { name: "name", label: "名称", type: "text", required: true },
      { name: "target", label: "目标", type: "text", required: true, placeholder: "https://… 或 host:port" },
      { name: "kind", label: "类型", type: "select", options: ["http", "tcp"] },
      { name: "interval_sec", label: "间隔(秒)", type: "number", placeholder: "60" },
      { name: "enabled", label: "启用", type: "boolean" },
    ],
  },
];

/** The status-like values that should render as an accent badge in lists. */
const ACTIVE_STATUSES = new Set(["在看", "在听", "在玩", "在用", "active", "看过", "看完", "通关", "听过"]);

export function isActiveStatus(status: string): boolean {
  return ACTIVE_STATUSES.has(status);
}

/** A registry row is an arbitrary record with an id + timestamps. */
export type Row = Record<string, unknown> & {
  id: string;
  created_at?: string;
  updated_at?: string;
};

export function fieldByName(spec: DomainSpec, name: string): FieldSpec | undefined {
  return spec.fields.find((f) => f.name === name);
}

/** The field used as the row's primary label (title/name/content). */
const FALLBACK_FIELD: FieldSpec = { name: "id", label: "ID", type: "text" };

export function titleField(spec: DomainSpec): FieldSpec {
  return (
    spec.fields.find(
      (f) => f.name === "title" || f.name === "name" || f.name === "content",
    ) ??
    spec.fields[0] ??
    FALLBACK_FIELD
  );
}
