# Production image for the web app (Next.js standalone). Built from the repo root:
#   DOCKER_BUILDKIT=1 docker build -f apps/web/Dockerfile .
# NEXT_PUBLIC_* is inlined at build time, so the public API URL is a build arg.
#
# BuildKit features used (Docker 23+/29 here):
#   - cache mount for bun's global install cache  -> deps are never re-downloaded
#   - cache mount for Turborepo's local FS cache  -> unchanged packages are skipped
#   - cache mount for Next/Turbopack's .next/cache -> incremental compiles reused
# syntax=docker/dockerfile:1.7
FROM oven/bun:1 AS builder
WORKDIR /app

# --- Dependency layer -------------------------------------------------------
# Copy ONLY the manifests + lockfile first so `bun install` is cached and only
# re-runs when a package.json / bun.lock actually changes (not on every source
# edit). The install cache mount means crates/npm tarballs persist across builds
# even when this layer is invalidated.
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
# turbo run -> reuses the Turborepo cache (shared mount) so an unchanged web app
# is a cache hit; .next/cache mount keeps Turbopack's incremental artifacts.
RUN --mount=type=cache,target=/app/.turbo,sharing=locked \
    --mount=type=cache,target=/app/apps/web/.next/cache,sharing=locked \
    bunx turbo run build --filter=web --cache-dir=/app/.turbo

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1
# Standalone output is traced from the monorepo root, so paths are mirrored.
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
