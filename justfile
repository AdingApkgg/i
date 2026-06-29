# `just <recipe>` — task runner. Most dev happens via docker compose,
# so these are thin wrappers + a few host helpers.

set dotenv-load := true

default:
    @just --list

# Bring up the whole stack (db, redis, minio, api, web, admin).
up:
    docker compose up

# Same, detached.
upd:
    docker compose up -d

down:
    docker compose down

# Tail logs for a service, e.g. `just logs api`.
logs service="":
    docker compose logs -f {{service}}

# Open a psql shell on the dev database.
psql:
    docker compose exec db psql -U i -d i

# Run backend checks (needs a local rust toolchain; otherwise use the api container).
check:
    cargo clippy --all-targets --all-features -- -D warnings

fmt:
    cargo fmt --all

# Generate a new sqlx migration file.
migrate name:
    @mkdir -p migrations
    @touch migrations/$(date +%Y%m%d%H%M%S)_{{name}}.sql
    @echo "created migrations/*_{{name}}.sql"

# Regenerate openapi.json + the typed TS client from the Rust API (in containers).
gen-api:
    docker run --rm -e CARGO_TARGET_DIR=/tmp/target -v "{{justfile_directory()}}:/app" -w /app rust:1-bookworm bash -lc "cargo run -p api -- --openapi" > openapi.json
    docker run --rm -v "{{justfile_directory()}}:/app" -w /app oven/bun:1 bash -lc "bun install && bunx --bun openapi-typescript openapi.json -o packages/api-client/src/schema.d.ts"
    @echo "regenerated openapi.json + packages/api-client/src/schema.d.ts"
