# Production image for the admin app (Next.js standalone). Built from the repo root:
#   DOCKER_BUILDKIT=1 docker build -f apps/admin/Dockerfile .
#
# Mirrors apps/web/Dockerfile: BuildKit cache mounts for bun install, the
# Turborepo FS cache, and Next/Turbopack's .next/cache.
# syntax=docker/dockerfile:1.7
FROM oven/bun:1 AS builder
WORKDIR /app

# --- Dependency layer (cached unless manifests/lockfile change) -------------
COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/api-client/package.json packages/api-client/package.json
RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
    bun install --frozen-lockfile

# --- Build layer ------------------------------------------------------------
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:8080
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=cache,target=/app/.turbo,sharing=locked \
    --mount=type=cache,target=/app/apps/admin/.next/cache,sharing=locked \
    bunx turbo run build --filter=admin --cache-dir=/app/.turbo

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3001
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/apps/admin/.next/standalone ./
COPY --from=builder /app/apps/admin/.next/static ./apps/admin/.next/static
EXPOSE 3001
CMD ["node", "apps/admin/server.js"]
