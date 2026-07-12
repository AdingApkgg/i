/**
 * Content-domain registry. Drives the public nav, the /dash admin sidebar, and
 * per-domain routing. Each domain is a self-contained content area carried over
 * from the v1 personal space.
 */
export interface DomainSpec {
  /** Stable key, also the tRPC router key + url segment. */
  key: string;
  /** 中文 label. */
  label: string;
  /** Public route, e.g. /blog. */
  path: string;
  /** Show in the primary public nav. */
  inNav: boolean;
  /** Has a /dash admin CRUD surface. */
  admin: boolean;
  /** One-line 中文 description for the admin sidebar / landing. */
  hint?: string;
}

export const DOMAINS: DomainSpec[] = [
  { key: "blog", label: "博客", path: "/blog", inNav: true, admin: true, hint: "文章 / CMS" },
  { key: "music", label: "音乐", path: "/music", inNav: true, admin: true, hint: "在听 / 歌单" },
  { key: "maimai", label: "舞萌", path: "/maimai", inNav: true, admin: true, hint: "maimaiDX 成绩" },
  { key: "movie", label: "影视", path: "/movie", inNav: true, admin: true, hint: "在看 / 看过" },
  { key: "vn", label: "视觉小说", path: "/vn", inNav: true, admin: true, hint: "Galgame 记录" },
  { key: "touhou", label: "东方", path: "/touhou", inNav: true, admin: true, hint: "东方 Project" },
  { key: "device", label: "设备", path: "/device", inNav: true, admin: true, hint: "在用装备" },
  { key: "gallery", label: "相册", path: "/gallery", inNav: true, admin: true, hint: "照片上传" },
  { key: "moments", label: "说说", path: "/moments", inNav: true, admin: true, hint: "碎碎念" },
  { key: "friends", label: "友链", path: "/friends", inNav: true, admin: true, hint: "友情链接" },
  { key: "monitor", label: "监控", path: "/monitor", inNav: false, admin: true, hint: "站点可用性" },
];

export const NAV_DOMAINS = DOMAINS.filter((d) => d.inNav);
export const ADMIN_DOMAINS = DOMAINS.filter((d) => d.admin);
