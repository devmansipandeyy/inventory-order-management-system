# Inventory Management — Frontend

A React + TypeScript + Vite single-page app for the Inventory Management System.
It talks to the FastAPI backend (default `http://localhost:8011`).

## Stack

- **Vite** + **React 18** + **TypeScript** (strict)
- **Tailwind CSS v4** via the `@tailwindcss/vite` plugin
- **React Router v6** for routing
- **TanStack Query v5** for all server state (queries + mutations with invalidation)
- **Recharts** for the dashboard bar chart and the demand-forecast line chart
- **Axios** for HTTP, with a Bearer-token interceptor and 401 → `/login` redirect
- **openapi-typescript** to generate `src/api/schema.ts` from the backend OpenAPI doc

## Prerequisites

- Node 20+ (Node 18+ works)
- The backend running and reachable (default `http://localhost:8011`)

## Setup

```bash
npm install

# Generate API types from the live backend OpenAPI schema.
# Requires the backend to be running at the URL in your gen:types script.
npm run gen:types

# Start the dev server (http://localhost:5173)
npm run dev
```

### Demo logins

- `admin@ethara.ai` / `admin123`
- `staff@ethara.ai` / `staff123`

These are also shown (and click-to-fill) on the login page.

## Scripts

| Script              | Description                                              |
| ------------------- | -------------------------------------------------------- |
| `npm run dev`       | Start Vite dev server with HMR                           |
| `npm run build`     | Type-check (`tsc -b`) and produce a production build     |
| `npm run preview`   | Preview the production build locally                     |
| `npm run lint`      | Run ESLint                                               |
| `npm run gen:types` | Regenerate `src/api/schema.ts` from the backend OpenAPI  |

## Environment variables

| Variable        | Default                  | Description                          |
| --------------- | ------------------------ | ------------------------------------ |
| `VITE_API_BASE` | `http://localhost:8011`  | Base URL of the FastAPI backend API. |

`VITE_API_BASE` is read in `src/lib/config.ts` and falls back to the default if unset.
Copy `.env.example` to `.env` to customize. `.env` is git-ignored.

```bash
cp .env.example .env
```

## Project structure

```
src/
  api/         Axios client, typed endpoint wrappers, hand-written types, generated schema.ts
  components/  Reusable UI (layout, modals, toasts, chat, primitives)
  hooks/       useAuth, useChat
  lib/         config, auth/token storage, formatting helpers
  pages/       One file per route
```

## Features

- Auth guard on all routes except `/login`; tokens in `localStorage`; auto-redirect on 401.
- Dashboard with KPI cards, low-stock alerts, recent movements, and a stock-value-by-category bar chart.
- Products: search / sort / pagination, create/edit/delete, stock adjustment, CSV import (with
  per-row error report on 422) and CSV export (authenticated download).
- Product detail with movement history and an AI demand-forecast chart + explanation.
- Categories and Suppliers CRUD.
- Purchase Orders: list, create (supplier + product lines), and receive.
- Audit log feed.
- AI Assistant (page + floating widget) with confirmation cards, 👍/👎 feedback, and a
  per-session id. Shows a banner when AI is disabled server-side.
- Reorder suggestions with one-click "Create PO".
- Evals: run + poll until done, big pass-rate number, per-case table, and past-run history.
- Prompts: list versions, create new version, activate.

## Production build / Docker

```bash
npm run build          # outputs to dist/

# Or build the container image (multi-stage: Node build -> nginx serve on :80)
docker build -t inventory-frontend .
docker run -p 8080:80 inventory-frontend
# Optionally bake a different API base:
docker build --build-arg VITE_API_BASE=https://api.example.com -t inventory-frontend .
```

`nginx.conf` serves the SPA with an `index.html` fallback so client-side routes work on refresh.
