# i · 个人空间 (v2)

[![CI](https://github.com/AdingApkgg/i/actions/workflows/ci.yml/badge.svg)](https://github.com/AdingApkgg/i/actions/workflows/ci.yml)

独属于某个变态的后花园。Next.js 全栈重写版。

## 技术栈

- **运行时/工具链**: bun + turborepo(单应用 + 共享包)
- **框架**: Next.js 16(app router)+ React 19 + TypeScript
- **后端**: 全进 Next · oRPC + @tanstack/react-query
- **数据**: Drizzle ORM(node-postgres)+ Postgres + Redis
- **认证**: better-auth(管理员 + 访客账号)
- **样式**: Tailwind v4 + shadcn/Radix · 萌系粉调 + Live2D 看板娘
- **代码风格**: Biome
- **部署**: Docker compose + nginx + Cloudflare Tunnel(自托管 VPS)

## 结构

```
apps/web            单 Next 全栈应用（公开前台 + /dash 后台路由组）
  src/app           路由（页面 + api/rpc + api/auth）
  src/server        oRPC procedure + routers（public/protected/admin procedure）
  src/lib           auth / orpc client+server
packages/db         Drizzle schema + client + redis + 脚本（@i/db）
packages/ui         shadcn 组件 + 萌系主题（@i/ui）
packages/config     站点配置 + 内容域注册表（@i/config）
```

## 本地开发

```bash
cp .env.example .env
# 本机端口可能冲突，按需覆盖：
WEB_PORT=13000 DB_PORT=15432 REDIS_PORT=16379 MINIO_PORT=19000 MINIO_CONSOLE_PORT=19001 \
  docker compose up
# → http://localhost:13000
```

## 测试

```bash
bun run test                          # turbo → vitest run（apps/web）
cd apps/web && bun run test:watch     # 监听模式
```

单测与源码同目录（`*.test.ts`）。数据层测试跑在进程内的 PGlite（WASM 版 Postgres）上，
表结构直接由 Drizzle schema 生成，唯一索引 / 外键 / 分页都是真 SQL；Redis、邮件、外部探测用 `vi.mock` 替身，
oRPC 路由用 `call(procedure, input, { context })` 直接调用。

CI（`.github/workflows/ci.yml`）每次推送依次跑 lint → typecheck → test → build。

## 数据库

```bash
bun run db:push     # 把 packages/db/src/schema.ts 同步到库（drizzle-kit push，已同步时无变更）
bun run db:studio   # Drizzle Studio
bun run db:seed     # 示例数据（幂等）
```

表 / 列 / 约束名沿用旧 Prisma 建的库（PascalCase 表名、`Model_col_key` 等），改名即改库结构。
部署时 compose 的 `migrate` 服务会先跑一次 `db:push`。

## 部署

```bash
cp .env.example .env   # 设置真实 BETTER_AUTH_SECRET / 密码 / 公网域名
docker compose -f compose.prod.yaml up -d --build
# 用 Cloudflare Tunnel 指向 127.0.0.1:8099
```

## 内容域

博客 · 音乐 · 舞萌 · 影视 · 视觉小说 · 东方 · 设备 · 相册 · 说说 · 友链 · 监控

## License

[AGPL-3.0](./LICENSE)
