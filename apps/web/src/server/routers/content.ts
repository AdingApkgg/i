import { z } from "zod";
import { crudRouter } from "../crud";

/** shared optional bits */
const rating = z.number().int().min(0).max(10).nullish();
const str = z.string().optional();
const text = z.string().optional();
// dash 通用编辑器把清空的数字输入发成 null，nullish→0 兜底（.default 只吃 undefined）
const sortOrder = z
  .number()
  .int()
  .nullish()
  .transform((v) => v ?? 0);

const bySort = [{ sortOrder: "asc" as const }, { createdAt: "desc" as const }];

// ---- 音乐 ----
export const musicRouter = crudRouter({
  model: (db) => db.track,
  orderBy: bySort,
  createSchema: z.object({
    title: z.string().min(1),
    artist: str,
    album: str,
    status: z.enum(["在听", "听过", "想听"]).default("在听"),
    rating,
    coverUrl: str,
    link: str,
    note: text,
    sortOrder,
  }),
});

// ---- 影视 ----
export const movieRouter = crudRouter({
  model: (db) => db.movie,
  orderBy: bySort,
  createSchema: z.object({
    title: z.string().min(1),
    category: str,
    status: z.enum(["在看", "看过", "想看"]).default("在看"),
    rating,
    year: z.number().int().nullish(),
    coverUrl: str,
    link: str,
    note: text,
    sortOrder,
  }),
});

// ---- 视觉小说 / Galgame ----
export const vnRouter = crudRouter({
  model: (db) => db.vn,
  orderBy: bySort,
  createSchema: z.object({
    title: z.string().min(1),
    brand: str,
    status: z.enum(["在玩", "通关", "想玩", "搁置"]).default("在玩"),
    rating,
    playHours: z.number().int().nullish(),
    coverUrl: str,
    link: str,
    note: text,
    sortOrder,
  }),
});

// ---- 东方 ----
export const touhouRouter = crudRouter({
  model: (db) => db.touhou,
  orderBy: bySort,
  createSchema: z.object({
    title: z.string().min(1),
    category: z.enum(["game", "music", "print", "doujin"]).optional(),
    status: z.string().default("收藏"),
    rating,
    coverUrl: str,
    link: str,
    note: text,
    sortOrder,
  }),
});

// ---- 设备 ----
export const deviceRouter = crudRouter({
  model: (db) => db.device,
  orderBy: bySort,
  createSchema: z.object({
    name: z.string().min(1),
    category: str,
    spec: str,
    status: z.enum(["在用", "退役", "想要"]).default("在用"),
    acquired: str,
    link: str,
    note: text,
    sortOrder,
  }),
});

// ---- 相册·图集 ----（照片在 ./gallery，专用路由：分页/批量移动/预览聚合）
export const albumsRouter = crudRouter({
  model: (db) => db.album,
  orderBy: bySort,
  createSchema: z.object({
    // 「未分类」是前台伪图集（albumId 为空的照片）的保留名，真实图集不得占用
    name: z
      .string()
      .min(1)
      .refine((v) => v !== "未分类", "「未分类」是保留名称"),
    description: text,
    coverUrl: str,
    sortOrder,
  }),
});

// ---- 说说 ----
export const momentsRouter = crudRouter({
  model: (db) => db.moment,
  orderBy: [{ createdAt: "desc" as const }],
  createSchema: z.object({
    content: z.string().min(1),
    mood: str,
  }),
});

// ---- 友链 ---- lives in ./friends (MX 式申请/审核/检测, not plain CRUD)

// ---- 监控 ---- lives in ./monitor (adds a `status` query + scheduler)

// ---- 舞萌 maimaiDX ---- lives in ./maimai (查分器 sync, not manual CRUD)
