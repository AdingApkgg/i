# i · 个人空间 (v2)

独属于某个变态的后花园。Next.js 全栈重写版。

## 技术栈

- **运行时/工具链**: bun + turborepo(单应用 + 共享包)
- **框架**: Next.js 16(app router)+ React 19 + TypeScript
- **后端**: 全进 Next · tRPC + @tanstack/react-query
- **数据**: Prisma 7(pg driver adapter)+ Postgres + Redis
- **认证**: better-auth(管理员 + 访客账号)
- **样式**: Tailwind v4 + shadcn/Radix · 萌系粉调 + Live2D 看板娘
- **代码风格**: Biome
- **部署**: Docker compose + nginx + Cloudflare Tunnel(自托管 VPS)

## 结构

```
apps/web            单 Next 全栈应用（公开前台 + /dash 后台路由组）
  src/app           路由（页面 + api/trpc + api/auth）
  src/server        tRPC init + routers（public/protected/admin procedure）
  src/lib           auth / trpc client+server
packages/db         Prisma schema + client + redis（@i/db）
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
