# Deployment

This project ships as a single multi-stage Docker container running on **Fly.io**. Inside the container, `nginx` serves the Vue SPA and reverse-proxies `/api/*` to the Hono server. SQLite (one file) persists on a Fly volume.

## Topology

```
                    HTTPS
   reviewer ──────────────► Fly edge (TLS terminates here)
                                  │  HTTP
                                  ▼
                    ┌─────────────────────────────────┐
                    │ Single Fly machine (fra region) │
                    │                                  │
                    │  ┌─────────────────────────┐    │
                    │  │ supervisord (PID 1)     │    │
                    │  │                          │    │
                    │  │  nginx :80 ──────────┐   │    │
                    │  │   │                  │   │    │
                    │  │   ├─ /        → /usr/share/nginx/html (SPA)
                    │  │   └─ /api/*   → 127.0.0.1:3001 (Hono)
                    │  │                          │   │    │
                    │  │  node tsx server :3001   │   │    │
                    │  └─────────────────────────┘    │
                    │             │                    │
                    │             ▼                    │
                    │  /app/prisma  ◄── Fly volume     │
                    │   dev.db                          │
                    └─────────────────────────────────┘
```

Hono binds **127.0.0.1** only — nginx is the sole public ingress.

## Files (artifact inventory)

| Path | Role |
|---|---|
| `Dockerfile` | Multi-stage build (web → SPA bundle, server → prod `node_modules` + Prisma client, runtime → alpine + nginx + node + supervisord). |
| `deploy/nginx.conf` | SPA fallback at `/`, `proxy_pass /api/ → http://127.0.0.1:3001`. |
| `deploy/supervisord.conf` | Process supervisor for `nginx` + `node tsx server/index.ts`. |
| `deploy/docker-entrypoint.sh` | Runs `prisma migrate deploy` on every boot and seeds the DB only when empty, then exec's supervisord. |
| `.dockerignore` | Excludes `node_modules`, `dev.db`, tests, docs, planning artifacts. |
| `fly.toml` | Fly app manifest (region, mounts, health check, autoscaling). |
| `server/bindConfig.ts` | Reads `HOST` / `PORT` env vars; defaults to `127.0.0.1:3001`. |
| `.github/workflows/ci.yml` | Lint, typecheck, vitest, Playwright on PR + push to master. |
| `.github/workflows/deploy.yml` | On successful CI on master: `flyctl deploy --remote-only`. |

## Deploy from scratch (five commands)

These run **once**, from your workstation, after `flyctl auth login`:

```sh
# 1. Scaffold app on Fly (skip if fly.toml already in repo)
flyctl apps create beygir-yarisi

# 2. Create the persistent SQLite volume
flyctl volumes create data --size 1 --region fra --yes

# 3. First deploy (uses fly.toml + Dockerfile in the repo root)
flyctl deploy --remote-only

# 4. Get an API token for CI
flyctl auth token

# 5. Add that token to GitHub → Settings → Secrets → Actions as FLY_API_TOKEN
```

Every push to `master` after that triggers CI → on success → `flyctl deploy --remote-only`.

## How CI/CD works

`ci.yml` runs on every PR and every push to `master`: it installs dependencies, generates the Prisma client, lints, typechecks, runs Vitest, runs Playwright (against a freshly seeded DB), and uploads the Playwright report on failure. `deploy.yml` is gated on `workflow_run` of `CI`: it only runs after CI green on `master` and only does `flyctl deploy --remote-only`, which builds the image on Fly's builder and rolls a new machine. Total wall clock from `git push` to live URL: roughly 3 minutes.

## Live URL

`https://beygir-yarisi.fly.dev` (once the first deploy lands).

## Cost

Fits comfortably inside Fly's free allowance: one shared-cpu-1x machine, 256 MB RAM, 1 GB volume, single region, `auto_stop_machines = "stop"` so the machine sleeps when idle. No paid add-ons.

## Local container smoke (optional)

```sh
docker build -t beygir-yarisi:dev .
docker run -p 8080:80 -v "$(pwd)/_data:/app/prisma" beygir-yarisi:dev
# open http://localhost:8080
```

The volume mount makes the first run create `_data/dev.db`; subsequent runs reuse it, mirroring the Fly volume behavior.
