# Deployment guide

Three deliverables to produce: a Docker Hub backend image, a hosted backend API URL,
and a hosted frontend URL. Order matters — backend first, then frontend (it needs the
backend URL baked in).

## 1. Backend image → Docker Hub

```bash
export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
docker login                                   # your Docker Hub username + password/token
docker build -t <DOCKERHUB_USER>/inventory-backend:latest ./backend
docker push <DOCKERHUB_USER>/inventory-backend:latest
```
Image link: `https://hub.docker.com/r/<DOCKERHUB_USER>/inventory-backend`

## 2. Backend API → Render (free, uses render.yaml)

1. Render Dashboard → **New → Blueprint** → connect the GitHub repo
   `devmansipandeyy/inventory-order-management-system`.
2. Render reads `render.yaml`: it creates a free **Postgres** + the **backend** Docker service.
3. Set the one secret it asks for: **OPENAI_API_KEY** (`gpt-4o`). `DATABASE_URL` and
   `JWT_SECRET` are wired automatically.
4. Deploy. The backend listens on Render's `$PORT`, seeds Postgres on first boot, and
   exposes `/health` and `/docs`.

Backend API URL: `https://inventory-backend-XXXX.onrender.com`
(Railway/Fly work too — any Docker host; the app reads `DATABASE_URL` + `PORT`.)

## 3. Frontend → Vercel (free)

1. Vercel → **Add New → Project** → import the same repo.
2. **Root Directory: `frontend`** (important). Framework auto-detects as Vite; `vercel.json`
   handles the SPA routing.
3. Add an environment variable **`VITE_API_BASE`** = the Render backend URL from step 2
   (e.g. `https://inventory-backend-XXXX.onrender.com`).
4. Deploy.

Frontend URL: `https://<project>.vercel.app`

CORS is already open (`CORS_ORIGINS=*`), so the Vercel frontend can call the Render backend
out of the box. (Netlify works identically: base dir `frontend`, build `npm run build`,
publish `dist`, same env var.)

## Demo logins
`admin@ethara.ai / admin123` (admin) · `staff@ethara.ai / staff123` (staff)
