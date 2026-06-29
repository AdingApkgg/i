# Deploy

Target: a single host (alice) that runs both dev and prod. The prod stack uses
built images and a separate compose project (`i-prod`) so it can coexist with
the dev stack (`i`).

## First deploy

```bash
cp .env.example .env
# REQUIRED before prod: set strong values
#   JWT_SECRET=...            (not the dev placeholder)
#   ADMIN_PASSWORD=...
#   MINIO_ROOT_PASSWORD=...
#   NEXT_PUBLIC_API_URL=https://api.example.com   # baked into the web build
docker compose -f compose.prod.yaml up -d --build
```

App ports bind to `127.0.0.1` only:

| service | local bind | default |
|---|---|---|
| web | `127.0.0.1:${WEB_PORT}` | 3000 |
| admin | `127.0.0.1:${ADMIN_PORT}` | 3001 |
| api | `127.0.0.1:${API_PORT}` | 8080 |

Front them with your existing reverse proxy — route your public domains to these
local ports (and lock down the admin one). If 3000/3001/8080 collide with the dev
stack or other services, override the `*_PORT` vars in `.env`.

## Update / redeploy

```bash
git pull
docker compose -f compose.prod.yaml up -d --build
```

No registry needed — images build on the host. (CI only verifies fmt/clippy/test
+ build; it does not push images.)

## Notes

- `NEXT_PUBLIC_API_URL` is inlined at **build** time, so changing the public API
  URL requires a rebuild (`--build`), not just a restart.
- Lock down `admin.*` (basic auth / IP allowlist / VPN) — it's the CMS.
- Dev stack lives in [../compose.yaml](../compose.yaml) (`docker compose up`).
