# Deploy

Target: a single host (alice) that runs both dev and prod. The prod stack uses
built images and a separate compose project (`i-prod`) so it can coexist with
the dev stack (`i`).

A bundled **nginx** container is the single entry point (self-contained), routing
everything same-origin:

| path | upstream |
|---|---|
| `/` | web (front site) |
| `/dash/` | admin CMS (built with `basePath=/dash`) |
| `/api/`, `/health`, `/openapi.json` | api |

Only the proxy publishes a host port; web/admin/api are reachable only inside the
compose network.

## First deploy

```bash
cp .env.example .env
# REQUIRED before prod: set strong values
#   JWT_SECRET=...            (not the dev placeholder)
#   ADMIN_PASSWORD=...
#   MINIO_ROOT_PASSWORD=...
docker compose -f compose.prod.yaml up -d --build
```

The proxy binds to `127.0.0.1:${PROXY_PORT:-8099}`:

- front site → `http://127.0.0.1:8099/`
- admin CMS → `http://127.0.0.1:8099/dash/`

Front that single port with the host's nginx/apache or a domain. Override
`PROXY_PORT` in `.env` if 8099 collides. **Lock down `/dash/`** (basic auth / IP
allowlist / VPN) — it's the CMS.

## Update / redeploy

```bash
git pull
docker compose -f compose.prod.yaml up -d --build
```

No registry needed — images build on the host. (CI only verifies fmt/clippy/test
+ build; it does not push images.)

## Notes

- The web/admin browser code calls the API **same-origin** (`/api`, `/health`)
  through nginx, so `NEXT_PUBLIC_API_URL` is left empty. Only set it (and rebuild)
  if you instead serve the API on a separate origin.
- `NEXT_PUBLIC_*` is inlined at **build** time, so changing it requires a rebuild
  (`--build`), not just a restart.
- Dev stack lives in [../compose.yaml](../compose.yaml) (`docker compose up`).
