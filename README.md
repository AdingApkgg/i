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
- **部署**: Docker compose + Caddy + Cloudflare Tunnel(自托管 VPS)

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

浏览器端到端测试（`apps/web/e2e/`，Playwright + Chromium）有两种跑法：

```bash
cd apps/web && bunx playwright install chromium   # 首次

# 1) 对着完整的生产栈（和 CI 一样）：Docker 镜像 + Postgres / Redis / SeaweedFS / 迁移 / Caddy
docker compose -f compose.prod.yaml -f .github/ci/compose.e2e.yaml up -d --build
docker compose -f compose.prod.yaml -f .github/ci/compose.e2e.yaml run --rm migrate bash -lc 'bun run --filter @i/db db:seed'
E2E_BASE_URL=http://localhost:8099 DATABASE_URL=postgres://i:i@localhost:5432/i bun run test:e2e

# 2) 对着本机的生产构建（需要迁移 + seed 过的 Postgres / Redis / SeaweedFS，环境变量同 .env）
bun run db:migrate && bun run db:seed && bun run build && bun run test:e2e
```

覆盖前台各页（状态码 / 水合告警 / 客户端路由 / 404 / 深色模式 / 缓存头）、登录、访客注册、
上传照片 → 缩略图 → 删除后存储回收、后台增改与表单校验、评论、友链申请与审核。
每个用例都会断言浏览器控制台没有错误和警告。

CI（`.github/workflows/ci.yml`）每次推送并行跑两个任务：
lint → 迁移文件检查 → typecheck → test → build；以及 e2e（用 `compose.prod.yaml` 构建并启动完整的生产栈，
Playwright 经 Caddy 访问，和线上部署走同一条路径）。

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

### 自动部署

GitHub → Actions → **Deploy** → Run workflow（`.github/workflows/deploy.yml`）：SSH 到服务器跑
`deploy/deploy.sh`（拉 main → 构建并启动，数据库迁移自动完成 → 重新加载 Caddy 配置 → 等站点就绪），然后清 Cloudflare 缓存。
两个可选项，都可以重复运行：

- **migrate_storage**：部署完再做一次 MinIO → SeaweedFS 的存储迁移（见下文「存储迁移」）
- **configure_cloudflare**：设置页面缓存规则（见下文「Cloudflare 缓存」；只作用于 `SITE_HOST`，规则只增改自己那一条）

服务器上要先有：用 `git clone https://github.com/AdingApkgg/i.git` 克隆的仓库、仓库里的 `.env`、
SSH 用户能直接运行 `docker`（在 docker 组里，或者把下面的 `DEPLOY_DOCKER` 设为 `sudo docker` 并给免密 sudo）。
GitHub Actions 的机器要能连上服务器的 SSH 端口。

仓库 Settings → Secrets and variables → Actions 里添加：

| 名称 | 类型 | 内容 |
| --- | --- | --- |
| `DEPLOY_HOST` | Secret | 服务器 IP 或域名（不要用经过 Cloudflare 代理的域名） |
| `DEPLOY_USER` | Secret | SSH 用户名 |
| `DEPLOY_SSH_KEY` | Secret | 专用私钥：`ssh-keygen -t ed25519 -N "" -C github-deploy -f deploy_key`，`deploy_key.pub` 追加到服务器 `~/.ssh/authorized_keys`，`deploy_key` 的全部内容填这里 |
| `DEPLOY_KNOWN_HOSTS` | Secret（可选） | `ssh-keyscan -p 端口 服务器` 的输出；不填时首次连接自动信任，日志里会打印指纹 |
| `CLOUDFLARE_API_TOKEN` | Secret（可选） | 不填就跳过 Cloudflare 步骤。My Profile → API Tokens → Create Custom Token，权限：Zone · Zone · Read、Zone · Cache Rules · Edit、Zone · Cache Purge · Purge；Zone Resources 选这个站点的域名 |
| `DEPLOY_PATH` | Variable（可选） | 服务器上仓库的路径，相对 SSH 用户的家目录或绝对路径（不要写 `~`），默认 `i` |
| `DEPLOY_PORT` | Variable（可选） | SSH 端口，默认 `22` |
| `DEPLOY_DOCKER` | Variable（可选） | 默认 `docker` |
| `CLOUDFLARE_ZONE` | Variable | Cloudflare 里的域名，如 `saop.cc` |
| `SITE_HOST` | Variable | 站点域名，如 `i.saop.cc` |

不方便从 GitHub 连服务器时，也可以在服务器上直接跑：`DEPLOY_PATH=~/i MIGRATE_STORAGE=1 bash deploy/deploy.sh`。

### 相册缩略图

存储里的图片（`/api/gallery/files/<key>`）加 `?w=320|640|960|1280|1920|2560` 取等比缩放的 WebP（不放大、保留 GIF 动画）。
第一次请求时用 sharp 生成并存回 SeaweedFS（`thumbs/w640/<key>.webp`），之后直接读；前台各处图片都已改用
`srcset`，浏览器按显示尺寸挑档位。灯箱的「下载」仍是原图。外链图片不受影响。

### Cloudflare 缓存

源站已给每类响应设好缓存头（`apps/web/src/server/cache.ts`）。`Cache-Control` 给浏览器，
`CDN-Cache-Control` 给 Cloudflare（它优先看这个头）：

| 响应 | 浏览器 | Cloudflare |
| --- | --- | --- |
| 前台页面、页面数据（`*.data`） | 每次重新取 | 1 分钟；过期后 1 分钟内先给旧版、后台刷新 |
| `/assets/*`、相册原图与缩略图 | 1 年（immutable） | 同左 |
| RSS / sitemap | 10 分钟 | 1 小时（过期后 1 天内先给旧版） |
| 分享卡片 | 1 小时 | 1 天（过期后 7 天内先给旧版） |
| `/dash`、`/api/*`、带 Set-Cookie 的、非 200 的页面 | 不缓存 | 不缓存 |
| 数据库出错时降级出来的页面（空列表）、RSS / sitemap（503） | 不缓存 | 不缓存 |

前台页面对所有人输出一样（登录状态在浏览器里取），所以可以放心让 CDN 缓存；发文、改内容后最多约 1 分钟生效，
急的话在 Cloudflare 后台 Purge 对应 URL。

**每次部署新版本后**，在 Cloudflare 后台 Caching → Configuration → **Purge Everything** 清一次缓存：
旧的 HTML 引用的是旧版本的 JS 文件，新容器里已经没有了，不清的话最多 2 分钟内可能有人打开页面报错。
用「自动部署」并配了 `CLOUDFLARE_API_TOKEN` 时，工作流部署完会自动清。

Cloudflare 默认不缓存 HTML，需要在面板里加一条缓存规则（「自动部署」勾选 configure_cloudflare 会用 API 完成，
不用手动做；`deploy/cloudflare.sh`）。

> ⚠️ 规则要等这个版本部署上线之后再加：规则会让 Cloudflare 照源站的缓存头缓存页面，
> 旧版本（Next.js）给静态页发的是 `s-maxage=31536000`，会被缓存一年。

**Caching → Cache Rules** 新建一条：
   - 匹配（Custom filter expression → Edit expression，域名换成你的）：
     ```
     http.host eq "i.saop.cc" and not starts_with(http.request.uri.path, "/dash") and not (starts_with(http.request.uri.path, "/api/") and not starts_with(http.request.uri.path, "/api/gallery/files/"))
     ```
   - Cache eligibility：**Eligible for cache**
   - Edge TTL：**Use cache-control header if present, bypass cache if not**
   - Browser TTL：**Respect origin**（不设的话 Cloudflare 会按 zone 的 Browser Cache TTL 把浏览器缓存时间改长，
     访客看不到更新。不要为此去改 Caching → Configuration 里的 Browser Cache TTL：那是整个域名的设置，
     同一域名下的其他站点也会跟着变）
   - 缓存键保持默认（包含查询串，缩略图靠 `?w=` 区分）

验证：同一个页面请求两次，第二次响应头应为 `cf-cache-status: HIT`，且 `cache-control` 仍是 `max-age=0`；
`/dash` 始终是 `DYNAMIC` 或 `BYPASS`。

### 存储迁移：MinIO → SeaweedFS（一次性）

相册文件从 MinIO 搬到 SeaweedFS。数据库里存的是 `/api/gallery/files/<key>`，key 不变，库不用改。
旧 `.env` 没有 `SEAWEEDFS_*` 时会沿用 `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` 作为新存储的凭据；
旧 `.env` 里的 `S3_ENDPOINT=http://minio:9000` 不用删，新版本固定连 SeaweedFS。

> ⚠️ `minio/minio` 镜像已经从 Docker Hub 下架（MinIO 不再发布社区版镜像）。迁移要用服务器上
> **现有的** MinIO 镜像，所以迁移完成前不要 `docker image prune -a` / `docker system prune -a`。
> 第一步 `up -d` 不会停掉正在运行的旧 MinIO 容器。

「自动部署」勾选 migrate_storage 就是依次执行下面四步；手动做：

```bash
docker compose -f compose.prod.yaml up -d --build                       # 新版本 + SeaweedFS
docker compose -f compose.prod.yaml --profile legacy up -d minio        # 旧 MinIO（还在跑则无变化；数据在 minio 卷里）
docker compose -f compose.prod.yaml --profile legacy run --rm storage-migrate   # 复制全部对象（可重复运行）
docker compose -f compose.prod.yaml --profile legacy stop minio
```

确认相册图片都正常后，可从 `compose.prod.yaml` 删掉 `minio` / `storage-migrate` 两个服务，
再 `docker volume rm iv2-prod_minio` 释放空间。

## 依赖升级

Renovate（`.github/renovate.json5`）有新正式版就提升级 PR，需要先在 GitHub 上安装 [Renovate App](https://github.com/apps/renovate) 并授权本仓库：

- 小版本 / 补丁合成一个 PR，跑完整 CI（含 e2e）全绿后由 Renovate 自动合并
- 大版本（以及 satori）列在 Dependency Dashboard issue 里，勾选后才提 PR；Node、React、Drizzle、oRPC 等相关包一起升
- Postgres 大版本的 PR 会提示先迁移数据目录；`biome.json` 的 `$schema` 跟着 Biome 版本一起改
- 每月刷新一次 `bun.lock`
- Mend 托管的 Renovate 装在「All repositories」下时默认是静默模式（只扫描，不提 PR / issue）：
  在 [developer.mend.io](https://developer.mend.io/) → 仓库 → Settings → Dependency Updates 里改成 Renovate（Automated PRs）

## 内容域

博客 · 音乐 · 舞萌 · 影视 · 视觉小说 · 东方 · 设备 · 相册 · 说说 · 友链 · 监控

## License

[AGPL-3.0](./LICENSE)
