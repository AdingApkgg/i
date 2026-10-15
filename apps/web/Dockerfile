# syntax=docker/dockerfile:1

# Node 24 LTS：react-router-hono-server 要求 Node ≥ 24.19。bun 只用来装依赖 / 跑脚本。
# bun 镜像版本和 package.json 的 packageManager 保持一致（bun.lock 的格式跟着 bun 版本走），Renovate 会一起升。

# ---- builder: install + react-router build (Vite 8) ----
FROM node:24-slim AS builder
COPY --from=oven/bun:1.4.3 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY . .
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile
ENV NODE_ENV=production
RUN bun run --filter @i/web build

# ---- deps: production node_modules only (server build keeps npm deps external) ----
FROM node:24-slim AS deps
COPY --from=oven/bun:1.4.3 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app
COPY package.json bun.lock ./
COPY patches/ patches/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/ui/package.json packages/ui/
COPY packages/config/package.json packages/config/
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --production

# ---- runner: Hono server (API + React Router SSR + static assets) ----
FROM node:24-slim AS runner
# build/client 按工作目录相对路径提供静态资源，所以在 apps/web 下启动
WORKDIR /app/apps/web
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=deps /app/apps/web/node_modules ./node_modules
COPY --from=builder /app/apps/web/build ./build
COPY apps/web/package.json ./
EXPOSE 3000
CMD ["node", "build/server/index.js"]
