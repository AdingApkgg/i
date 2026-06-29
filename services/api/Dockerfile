# Production image for the API. (Dev uses the rust container in compose.yaml.)
# Uses cargo-chef so the dependency layer is cached across source changes.

FROM rust:1-bookworm AS chef
RUN cargo install cargo-chef --locked
WORKDIR /app

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release -p api --recipe-path recipe.json
COPY . .
RUN cargo build --release -p api

FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /app/target/release/api /usr/local/bin/api
COPY migrations ./migrations
EXPOSE 8080
CMD ["api"]
