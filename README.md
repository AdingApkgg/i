# i

个人空间 monorepo — 自包含的内容站 + 自实现的周边基础设施(计数 / 评论 / 监控 / 媒体追踪)。

- **后端**:Rust + axum,模块化单体(modular monolith),每个领域一个 crate,统一由 `services/api` 挂载。数据层 sqlx + Postgres。
- **前端**:Next.js 16 + React 19 + Tailwind v4,bun workspace。`apps/web`(前台)+ `apps/admin`(后台 CMS)。
- **环境**:docker compose 一把梭(postgres / redis / minio / api / web / admin),宿主机只需 Docker。

## 快速开始

```bash
cp .env.example .env
docker compose up        # 或 just up
```

| 服务 | 地址 |
|------|------|
| 前台 web | http://localhost:3000 |
| 后台 admin | http://localhost:3001 |
| API | http://localhost:8080 |
| MinIO 控制台 | http://localhost:9001 |

首次启动会在容器内拉取并编译依赖(Rust 首编需几分钟),之后由 `cargo-target` / `node_modules` 卷缓存。

## 仓库结构

```
apps/
  web/                 前台 Next.js
  admin/               后台 CMS
packages/
  ui/                  共享设计系统组件
  api-client/          访问后端 API 的类型化客户端
crates/
  core/                AppState / 配置 / 错误 / tracing
  db/                  sqlx 连接池 + 迁移
  auth/                Rust 自持鉴权(JWT)
  analytics/           访问计数(替代/导入 bsz)
  blog/                博客 CMS(文章全进 DB)
  library/             统一媒体追踪:已玩过/在玩/在看/在听 …
  comments/  (stub)    评论(参考 Artalk,后续导入 artalk/twikoo/waline)
  monitor/   (stub)    站点监控(后台可配,替代 UptimeStatus)
  maimai/    (stub)    舞萌成绩/牌子
services/
  api/                 唯一后端二进制,nest 所有领域 router
migrations/            sqlx 迁移
```

## 领域路由约定

每个领域 crate 暴露 `pub fn router() -> axum::Router<AppState>`;新增内容 = 新 crate + 在 `services/api` 里加一行 `.nest("/api/<x>", x::router())`。

## 数据迁移(后续)

旧项目不并入代码,只做一次性数据导入:

- `bsz` 导出 → `analytics`
- `artalk` / `twikoo` / `waline` 导出 → `comments`(各写一个 adapter)

## 路线图

- **P0** 骨架(本提交):workspace + compose + CI + 鉴权骨架 ✅
- **P1** home + blog CMS + 设计系统 `packages/ui`
- **P2** admin + `library`(撑起 music/movie/gal/东方/device 展示)+ `monitor`
- **P3** `comments`(+导入)+ `analytics`(+导入 bsz)
- **P4** `maimai` + 打磨

## License

AGPL-3.0-or-later
