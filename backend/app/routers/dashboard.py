from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import AuditLog, Customer, Order, Product, PurchaseOrder, StockMovement
from app.schemas import AuditOut, DashboardSummary, MovementOut
from app.services import stock as stock_svc

router = APIRouter(tags=["dashboard"], dependencies=[Depends(get_current_user)])


@router.get("/dashboard/summary", response_model=DashboardSummary)
async def summary(db: AsyncSession = Depends(get_db)):
    total_skus = (await db.execute(select(func.count(Product.id)))).scalar_one()
    total_customers = (await db.execute(select(func.count(Customer.id)))).scalar_one()
    total_orders = (await db.execute(select(func.count(Order.id)))).scalar_one()
    products = (await db.execute(select(Product))).scalars().all()
    levels = await stock_svc.on_hand_map(db, [p.id for p in products])

    total_units = sum(levels.get(p.id, 0) for p in products)
    stock_value = sum(levels.get(p.id, 0) * p.cost_price for p in products)
    low_stock_count = sum(1 for p in products if levels.get(p.id, 0) <= p.reorder_point)
    pending_pos = (
        await db.execute(select(func.count(PurchaseOrder.id)).where(PurchaseOrder.status != "received"))
    ).scalar_one()

    recent = (
        await db.execute(select(StockMovement).order_by(desc(StockMovement.created_at)).limit(10))
    ).scalars().all()

    return DashboardSummary(
        total_skus=total_skus, total_customers=total_customers, total_orders=total_orders,
        total_units=total_units, stock_value=round(stock_value, 2),
        low_stock_count=low_stock_count, pending_pos=pending_pos,
        recent_movements=[MovementOut.model_validate(m) for m in recent],
    )


@router.get("/reports/low-stock")
async def low_stock(db: AsyncSession = Depends(get_db)):
    return await stock_svc.low_stock(db)


@router.get("/reports/valuation")
async def valuation(db: AsyncSession = Depends(get_db)):
    products = (await db.execute(select(Product))).scalars().all()
    levels = await stock_svc.on_hand_map(db, [p.id for p in products])
    rows = [
        {
            "product_id": p.id, "sku": p.sku, "name": p.name, "on_hand": levels.get(p.id, 0),
            "cost_price": p.cost_price, "value": round(levels.get(p.id, 0) * p.cost_price, 2),
        }
        for p in products
    ]
    return {"rows": rows, "total_value": round(sum(r["value"] for r in rows), 2)}


@router.get("/audit", response_model=list[AuditOut])
async def audit(db: AsyncSession = Depends(get_db), limit: int = 100):
    return (
        await db.execute(select(AuditLog).order_by(desc(AuditLog.created_at)).limit(limit))
    ).scalars().all()
