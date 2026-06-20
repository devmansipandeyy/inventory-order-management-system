from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import SessionLocal, init_models
from app.routers import (
    ai, auth, catalog, customers, dashboard, orders, products, purchase_orders, stock,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_models()
    if settings.seed_on_startup:
        from app.seed import seed
        async with SessionLocal() as db:
            await seed(db)
    yield


app = FastAPI(
    title="Ethara Inventory API",
    version="0.1.0",
    description="AI-powered Inventory Management System (FastAPI). "
                "Agentic assistant, demand forecasting, and an agent eval harness.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(status_code=400, content={"detail": str(exc)})


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok", "ai_enabled": settings.ai_enabled}


app.include_router(auth.router)
app.include_router(catalog.router)
app.include_router(customers.router)
app.include_router(products.router)
app.include_router(orders.router)
app.include_router(stock.router)
app.include_router(purchase_orders.router)
app.include_router(dashboard.router)
app.include_router(ai.router)
