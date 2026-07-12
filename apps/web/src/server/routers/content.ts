import { z } from "zod";
import { crudRouter } from "../crud";

/** shared optional bits */
const rating = z.number().int().min(0).max(10).nullish();
const str = z.string().optional();
const text = z.string().optional();
const sortOrder = z.number().int().default(0);

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

// ---- 相册 ----
export const galleryRouter = crudRouter({
  model: (db) => db.photo,
  orderBy: bySort,
  createSchema: z.object({
    title: z.string().min(1),
    imageUrl: z.string().min(1),
    thumbUrl: str,
    description: text,
    takenAt: str,
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

// ---- 友链 ----
export const friendsRouter = crudRouter({
  model: (db) => db.friend,
  orderBy: [{ sortOrder: "asc" as const }, { createdAt: "desc" as const }],
  createSchema: z.object({
    name: z.string().min(1),
    url: z.string().min(1),
    avatarUrl: str,
    description: text,
    status: z.enum(["active", "pending"]).default("active"),
    sortOrder,
  }),
});

// ---- 监控 ---- (scheduler + status added in Phase 2)
export const monitorRouter = crudRouter({
  model: (db) => db.monitor,
  orderBy: bySort,
  createSchema: z.object({
    name: z.string().min(1),
    target: z.string().min(1),
    kind: z.enum(["http", "tcp"]).default("http"),
    intervalSec: z.number().int().default(60),
    enabled: z.boolean().default(true),
  }),
});

// ---- 舞萌 maimaiDX ----
export const maimaiRouter = crudRouter({
  model: (db) => db.maimaiScore,
  orderBy: [{ sortOrder: "asc" as const }, { achievement: "desc" as const }],
  createSchema: z.object({
    songTitle: z.string().min(1),
    difficulty: z.enum(["BASIC", "ADVANCED", "EXPERT", "MASTER", "RE:MASTER"]).default("MASTER"),
    level: str,
    achievement: z.number().nullish(),
    rank: str,
    comboFlag: str,
    syncFlag: str,
    coverUrl: str,
    note: text,
    sortOrder,
  }),
});
