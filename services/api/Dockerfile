# syntax=docker/dockerfile:1.7
# Production image for the API. (Dev uses the rust container in compose.yaml.)
#
# Speed strategy:
#   - cargo-chef: dependency layer is cached across source changes.
#   - BuildKit cache mounts (--mount=type=cache) for the cargo registry, git db
#     and the target dir, so crates are NEVER re-downloaded or recompiled across
#     builds — even when the cargo-chef recipe changes, sccache backfills hits.
#   - mold linker (.cargo/config.toml) for fast final links.
#   - sccache as RUSTC_WRAPPER, sharing a cache mount with the dev container's
#     sccache volume contents is not possible across the docker/host boundary,
#     but the cache mount makes it persistent across image builds on this host.
#
# Build with BuildKit (default on Docker 23+):
#   docker buildx build -f services/api/Dockerfile -t i-api .

FROM rust:1-bookworm AS chef
# mold: parallel linker invoked via -fuse-ld=mold in .cargo/config.toml.
# clang: used as the linker driver (config sets linker = "clang").
# sccache: compiler cache wrapper.
RUN apt-get update && apt-get install -y --no-install-recommends mold clang \
    && rm -rf /var/lib/apt/lists/*
# sccache from a prebuilt binary (compiling it from source added ~5min to cold
# builds). cargo-chef is small, so it stays a source install.
ARG SCCACHE_VERSION=0.8.2
RUN curl -fsSL "https://github.com/mozilla/sccache/releases/download/v${SCCACHE_VERSION}/sccache-v${SCCACHE_VERSION}-x86_64-unknown-linux-musl.tar.gz" \
      | tar -xz -C /tmp \
    && install -m0755 "/tmp/sccache-v${SCCACHE_VERSION}-x86_64-unknown-linux-musl/sccache" /usr/local/bin/sccache \
    && rm -rf /tmp/sccache-* \
    && cargo install cargo-chef --locked
ENV RUSTC_WRAPPER=sccache \
    SCCACHE_DIR=/sccache \
    CARGO_INCREMENTAL=0
WORKDIR /app

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
# Cook dependencies. Cache mounts persist the registry, git db, the target dir
# and the sccache store across builds. id= keys are shared with the final build
# step so the cooked deps are reused, not rebuilt.
RUN --mount=type=cache,id=cargo-registry,target=/usr/local/cargo/registry \
    --mount=type=cache,id=cargo-git,target=/usr/local/cargo/git \
    --mount=type=cache,id=api-target,target=/app/target \
    --mount=type=cache,id=sccache,target=/sccache \
    cargo chef cook --release -p api --recipe-path recipe.json
COPY . .
# Build the binary. Same cache mounts. The target dir is a cache mount (not part
# of the image layer), so we copy the finished binary out to a real path before
# the mount is unmounted.
RUN --mount=type=cache,id=cargo-registry,target=/usr/local/cargo/registry \
    --mount=type=cache,id=cargo-git,target=/usr/local/cargo/git \
    --mount=type=cache,id=api-target,target=/app/target \
    --mount=type=cache,id=sccache,target=/sccache \
    cargo build --release -p api \
    && cp /app/target/release/api /usr/local/bin/api \
    && sccache --show-stats

FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /usr/local/bin/api /usr/local/bin/api
COPY migrations ./migrations
EXPOSE 8080
CMD ["api"]
