# i · 个人空间 (v2)

[![CI](https://github.com/AdingApkgg/i/actions/workflows/ci.yml/badge.svg)](https://github.com/AdingApkgg/i/actions/workflows/ci.yml)

独属于某个变态的后花园。Hono + React Router 全栈重写版。

## 技术栈

- **运行时/工具链**: Node 24 LTS + bun(包管理 / 脚本)+ turborepo(单应用 + 共享包)
- **框架**: React Router 8(framework mode,SSR)+ Vite 8 + React 19 + TypeScript
- **服务端**: Hono(react-router-hono-server)· oRPC + @tanstack/react-query
- **数据**: Drizzle ORM(node-postgres)+ Postgres + Redis
- **认证**: better-auth(管理员 + 访客账号)
- **样式**: Tailwind v4 + shadcn/Radix · 萌系粉调 + Live2D 看板娘
- **代码风格**: Biome
- **对象存储**: SeaweedFS(S3 网关,相册上传)· aws4fetch · sharp 缩略图(WebP,按需生成)
- **测试**: Vitest(单测,PGlite)+ Playwright(浏览器端到端)
- **部署**: Docker compose + nginx + Cloudflare Tunnel(自托管 VPS)

## 结构

```
apps/web            单全栈应用（公开前台 + /dash 后台）
  src/hono.ts       服务端入口：Hono 处理 API / auth / RSS / OG，其余交给 React Router
  src/routes.ts     页面路由表；src/routes/** 路由模块（loader + meta + 组件）
  src/root.tsx      HTML 骨架 / 全局 Provider
  src/server        oRPC procedure + routers、Hono 端点（http.ts）、定时任务
  src/lib           auth / orpc client + api.server（loader 直调）/ seo / og
packages/db         Drizzle schema + client + redis + 脚本（@i/db）
packages/ui         shadcn 组件 + 萌系主题（@i/ui）
packages/config     站点配置 + 内容域注册表（@i/config）
```

## 本地开发

```bash
cp .env.example .env
# 本机端口可能冲突，按需覆盖：
WEB_PORT=13000 DB_PORT=15432 REDIS_PORT=16379 S3_PORT=18333 \
  docker compose up
# → http://localhost:13000
```

不用 Docker 时：

```bash
bun install
bun run db:migrate && bun run db:seed   # 需要 DATABASE_URL
bun run dev                          # Node ≥ 24.19（见 .node-version）
```

## 测试

```bash
bun run test                          # turbo → vitest run（apps/web）
cd apps/web && bun run test:watch     # 监听模式
```

单测与源码同目录（`*.test.ts`）。数据层测试跑在进程内的 PGlite（WASM 版 Postgres）上，
表结构由真实的迁移文件建出，唯一索引 / 外键 / 分页都是真 SQL；Redis、邮件、外部探测用 `vi.mock` 替身，
oRPC 路由用 `call(procedure, input, { context })` 直接调用。

浏览器端到端测试（`apps/web/e2e/`，Playwright + Chromium）跑在生产构建上，需要迁移 + seed 过的
Postgres、Redis、SeaweedFS（`docker compose up -d db redis seaweedfs` 即可）：

```bash
bun run db:migrate && bun run db:seed && bun run build
cd apps/web && bunx playwright install chromium   # 首次
bun run test:e2e                                  # 环境变量同 .env（DATABASE_URL、S3_* 等）
```

覆盖前台各页（状态码 / 水合告警 / 客户端路由 / 404 / 深色模式）、登录、上传照片与缩略图、后台增改、评论、友链审核。
每个用例都会断言浏览器控制台没有错误和警告。

CI（`.github/workflows/ci.yml`）每次推送并行跑两个任务：
lint → 迁移文件检查 → typecheck → test → build；以及 e2e（Postgres / Redis 服务容器 + compose 里的 SeaweedFS）。

## 数据库

表结构定义在 `packages/db/src/schema.ts`，变更走版本化迁移（`packages/db/drizzle/*.sql`，随代码提交）：

```bash
# 1. 改 schema.ts
bun run db:generate   # 2. 生成迁移 SQL（改名字段时会询问是重命名还是删了重建）
                      # 3. 审一下生成的 SQL，连同 schema.ts 一起提交
bun run db:migrate    # 应用未执行的迁移（部署时 compose 的 migrate 服务自动跑）
bun run db:studio     # Drizzle Studio
bun run db:seed       # 示例数据（幂等）
```

CI 会检查 schema.ts 与迁移文件是否一致，忘了 `db:generate` 会直接失败。
表 / 列 / 约束名沿用旧 Prisma 建的库（PascalCase 表名、`Model_col_key` 等）；
已有的库第一次跑 `db:migrate` 时会自动把 `0000_init` 记为已执行（基线），不会重建表。
`bun run db:push` 仍可用于本地快速试验，别对生产库用。

## 部署

```bash
cp .env.example .env   # 设置真实 BETTER_AUTH_SECRET / SEAWEEDFS_SECRET_KEY / 公网域名
docker compose -f compose.prod.yaml up -d --build
# 用 Cloudflare Tunnel 指向 127.0.0.1:8099
```

### 相册缩略图

存储里的图片（`/api/gallery/files/<key>`）加 `?w=320|640|960|1280|1920|2560` 取等比缩放的 WebP（不放大、保留 GIF 动画）。
第一次请求时用 sharp 生成并存回 SeaweedFS（`thumbs/w640/<key>.webp`），之后直接读；前台各处图片都已改用
`srcset`，浏览器按显示尺寸挑档位。灯箱的「下载」仍是原图。外链图片不受影响。

### Cloudflare 缓存

源站已给每类响应设好缓存头（`apps/web/src/server/cache.ts`）。`Cache-Control` 给浏览器，
`CDN-Cache-Control` 给 Cloudflare（它优先看这个头）：

| 响应 | 浏览器 | Cloudflare |
| --- | --- | --- |
| 前台页面、页面数据（`*.data`） | 每次重新取 | 1 分钟；过期后 10 分钟内先给旧版、后台刷新 |
| `/assets/*`、相册原图与缩略图 | 1 年（immutable） | 同左 |
| RSS / sitemap | 10 分钟 | 1 小时（过期后 1 天内先给旧版） |
| 分享卡片 | 1 小时 | 1 天（过期后 7 天内先给旧版） |
| `/dash`、`/api/*`、带 Set-Cookie 的、非 200 的页面 | 不缓存 | 不缓存 |

前台页面对所有人输出一样（登录状态在浏览器里取），所以可以放心让 CDN 缓存；发文、改内容后最多约 1 分钟生效，
急的话在 Cloudflare 后台 Purge 对应 URL。

Cloudflare 默认不缓存 HTML，需要在面板里设置两处：

1. **Caching → Configuration → Browser Cache TTL** 设为 **Respect Existing Headers**
   （否则 Cloudflare 会把页面的浏览器缓存时间改长，访客看不到更新）。
2. **Caching → Cache Rules** 新建一条：
   - 匹配（Edit expression）：
     ```
     not starts_with(http.request.uri.path, "/dash") and not (starts_with(http.request.uri.path, "/api/") and not starts_with(http.request.uri.path, "/api/gallery/files/"))
     ```
   - Cache eligibility：**Eligible for cache**
   - Edge TTL：**Use cache-control header if present, bypass cache if not**
   - Browser TTL：**Respect origin**
   - 缓存键保持默认（包含查询串，缩略图靠 `?w=` 区分）

验证：同一个页面请求两次，第二次响应头应为 `cf-cache-status: HIT`，且 `cache-control` 仍是 `max-age=0`；
`/dash` 始终是 `DYNAMIC` 或 `BYPASS`。

### 存储迁移：MinIO → SeaweedFS（一次性）

相册文件从 MinIO 搬到 SeaweedFS。数据库里存的是 `/api/gallery/files/<key>`，key 不变，库不用改。
旧 `.env` 没有 `SEAWEEDFS_*` 时会沿用 `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` 作为新存储的凭据。

```bash
docker compose -f compose.prod.yaml up -d --build                       # 新版本 + SeaweedFS
docker compose -f compose.prod.yaml --profile legacy up -d minio        # 临时拉起旧 MinIO（数据还在 minio 卷里）
docker compose -f compose.prod.yaml --profile legacy run --rm storage-migrate   # 复制全部对象（可重复运行）
docker compose -f compose.prod.yaml --profile legacy stop minio
```

确认相册图片都正常后，可从 `compose.prod.yaml` 删掉 `minio` / `storage-migrate` 两个服务，
再 `docker volume rm iv2-prod_minio` 释放空间。

## 依赖升级

Renovate（`.github/renovate.json5`）每周一早上提升级 PR，需要先在 GitHub 上安装 [Renovate App](https://github.com/apps/renovate) 并授权本仓库：

- 小版本 / 补丁合成一个 PR，跑完整 CI（含 e2e）后手动合并；新版本发布满 3 天才会提
- 大版本（以及 satori）列在 Dependency Dashboard issue 里，勾选后才提 PR；Node、React、Drizzle、oRPC 等相关包一起升
- Postgres 大版本的 PR 会提示先迁移数据目录；`biome.json` 的 `$schema` 跟着 Biome 版本一起改
- 每月刷新一次 `bun.lock`

## 内容域

博客 · 音乐 · 舞萌 · 影视 · 视觉小说 · 东方 · 设备 · 相册 · 说说 · 友链 · 监控

## License

[AGPL-3.0](./LICENSE)
