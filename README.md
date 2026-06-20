# Ethara Inventory — AI-Powered Inventory Management System

A full-stack Inventory Management System with an **agentic AI assistant**, **demand
forecasting**, and an **agent evaluation harness**. Built for the Ethara AI engineering
assessment.

> Why the AI/eval layer is the centerpiece: Ethara builds RLHF/SFT datasets and
> agent-evaluation frameworks (Milo-Bench). So this project treats the AI agent as a
> measured artifact — every agent response is scored by a built-in eval harness, and
> prompts are versioned and A/B-compared. That mirrors how Ethara works.

---

## Stack

| Layer | Tech |
|------|------|
| Frontend | React + TypeScript + Vite, Tailwind CSS, TanStack Query, React Router, Recharts |
| Backend | FastAPI, async SQLAlchemy 2.0, Pydantic v2, JWT auth |
| Database | PostgreSQL (Docker) / SQLite (local dev + tests) |
| AI | OpenAI (tool-calling agent, forecasting narration, eval harness) |
| Infra | Docker + docker-compose; images publishable to ghcr.io |

## Architecture

```
              ┌─────────────┐      JWT      ┌──────────────────────────┐      ┌────────────┐
  Browser ───▶│  React SPA  │ ────────────▶ │  FastAPI (async)         │ ───▶ │ PostgreSQL │
              │  (nginx)    │   REST/JSON   │  router → service → repo │      └────────────┘
              └─────────────┘               │                          │
                                            │  AI layer:               │      ┌────────────┐
                                            │   • agent (tool-calling) │ ───▶ │ OpenAI API │
                                            │   • forecasting (Holt)   │      └────────────┘
                                            │   • eval harness         │
                                            └──────────────────────────┘
```

Two design decisions worth calling out (from the engineering review):

1. **On-hand stock is derived, never stored.** `on_hand = SUM(StockMovement.qty_delta)`.
   Concurrent stock changes cannot race or drift, and the movement ledger is the single
   source of truth (it doubles as the audit trail).
2. **Agent write actions are human-in-the-loop.** The agent never mutates data directly.
   It proposes an action → the server persists a `PendingAction` and returns it →
   the user confirms → only then does it execute. (No coroutine suspended across HTTP.)

## Features

- **Auth** — JWT (access + refresh), bcrypt, role-based (admin / staff).
- **Products** — full CRUD with search, sort, pagination. SKU is unique.
- **Customers** — CRUD; email is unique.
- **Orders** (customer sales orders) — create / list / view / cancel. The backend
  **computes the total automatically**, **reduces stock on creation**, **blocks orders
  when inventory is insufficient**, and **restores stock on cancellation**.
- **Categories & Suppliers** — CRUD (suppliers are the supply-side counterpart to customers).
- **Stock** — movement ledger (purchase/sale/adjustment/return), derived levels, low-stock
  alerts. **Stock can never go negative.**
- **Purchase orders** — supplier restock orders; receiving generates stock movements.
- **Dashboard & reports** — KPIs (products, customers, orders, stock value, low-stock),
  valuation, low-stock, movement history.
- **CSV** — bulk product import (per-row validation, no partial commits) + export.
- **Audit log** — every stock change and AI action.
- **AI assistant** — agentic chat that takes real actions via tool-calling, with
  confirmation for writes and 👍/👎 feedback.
- **Demand forecasting** — Holt's exponential smoothing computed in Python; the LLM only
  narrates (numbers never come from the model).
- **Reorder suggestions** — low-stock + forecast → one-click purchase order.
- **Agent eval harness** — a golden set of questions auto-scored on tool-selection and
  answer accuracy, with a pass-rate dashboard.
- **Prompt playground** — versioned system prompts, A/B-comparable via the eval harness.

## Quick start (Docker — one command)

```bash
cp .env.example .env        # optional: paste your OPENAI_API_KEY for AI features
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API + docs: http://localhost:8000/docs
- Demo logins: `admin@ethara.ai / admin123` (admin), `staff@ethara.ai / staff123` (staff)

The database is seeded automatically on first boot (12 products, suppliers, categories,
sales history). Without an `OPENAI_API_KEY`, every non-AI feature works and AI endpoints
return a clear "AI disabled" message.

## Local development

**Backend**
```bash
cd backend
uv venv && source .venv/bin/activate
uv pip install -e ".[dev]"
cp .env.example .env        # add OPENAI_API_KEY to enable AI
uvicorn app.main:app --reload      # http://localhost:8000/docs
pytest -q                          # 23 tests
```

**Frontend**
```bash
cd frontend
npm install
npm run gen:types           # generates TS types from the backend OpenAPI schema
npm run dev                 # http://localhost:5173
```

## Tests

The backend ships with 28 tests covering the parts most worth proving:
- **Stock concurrency** — 25 concurrent movements lose nothing (derived on-hand).
- **Order rules** — total computed by backend, stock reduced on order, order blocked when
  inventory insufficient, cancel restores stock, customer email unique, stock never negative.
- **Agent confirmation** — confirm executes, reject is a no-op, double-confirm is guarded.
- **CSV import** — a bad row commits nothing (per-row error report).
- **Auth** — token issue/validate, protected routes, 401 on bad token.
- **Forecasting + eval scoring** — pure functions with known inputs.

## Submission repo mapping

This monorepo maps cleanly to the three requested repos:
- `backend/`  → Backend repository (FastAPI + Dockerfile + tests)
- `frontend/` → Frontend repository (React + Dockerfile)
- root (`docker-compose.yml`, this README) → Deploy repository

## Security note

Secrets live only in gitignored `.env` files. Never commit them. The JWT secret and
OpenAI key must be set via environment in any real deployment.
