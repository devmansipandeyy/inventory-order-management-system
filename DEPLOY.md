# Deployment guide

Live stack: **backend on Northflank** (free tier, always-on — no idle sleep),
**Postgres on Neon** (free), **frontend on Vercel** (free), with **CI/CD** on every push
to `main`. Deploy order: database first, then backend, then frontend (it needs the backend URL).

## 1. Database → Neon (free Postgres)

Create a project at https://neon.tech → copy the **connection string** (Connect button); it
looks like `postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/db?sslmode=require`.
It becomes the backend's `DATABASE_URL`. The backend strips libpq-only params (`sslmode`,
`channel_binding`) and negotiates SSL via asyncpg, so paste it as-is.

## 2. Backend → Northflank (free, always-on)

Northflank's free Developer Sandbox runs containers **always-on** (no spin-down), builds the
`backend/Dockerfile` straight from GitHub, and **auto-redeploys on every push** to `main`.

**CLI path:**
```bash
npm i -g @northflank/cli
northflank login                      # opens a browser
```
Then create a **combined service** (build + deploy) — repo
`devmansipandeyy/inventory-order-management-system`, branch `main`, build type **Dockerfile**,
dockerfile path `backend/Dockerfile`, build context `backend`, port **8000**, health `/health`.

**Dashboard path:** New → Service → **Combined service** → select the repo + `main` branch →
Build options: **Dockerfile** (path `backend/Dockerfile`, context `backend`) → port `8000`.

**Environment variables** (Service → Environment):
- `DATABASE_URL` = the Neon string from step 1
- `JWT_SECRET` = a long random string (`openssl rand -hex 32`)
- `OPENAI_API_KEY` = your rotated key (optional — omit and AI features stay off, rest works)
- `OPENAI_MODEL` = `gpt-4o`, `CORS_ORIGINS` = `*`, `SEED_ON_STARTUP` = `true`

Backend URL: `https://<service>--<project>.code.run` (`/docs` for Swagger, `/health` for liveness).

## 3. Frontend → Vercel (free)

1. Vercel → **Add New → Project** → import the same repo.
2. **Root Directory: `frontend`** (important). Framework auto-detects as Vite; `vercel.json`
   handles SPA routing.
3. Add env var **`VITE_API_BASE`** = the Northflank backend URL from step 2.
4. Deploy. Frontend URL: `https://<project>.vercel.app`.

CORS is open (`CORS_ORIGINS=*`), so Vercel → Northflank works out of the box.

## 4. CI/CD

- **Backend** — Northflank's Git integration is the pipeline: linking the repo builds and
  redeploys on every push to `main`. No tokens or workflow files needed.
- **Frontend** — Vercel's Git integration does the same: production on push to `main`,
  preview deploys on PRs.

## Demo logins
`admin@ethara.ai / admin123` (admin) · `staff@ethara.ai / staff123` (staff)
