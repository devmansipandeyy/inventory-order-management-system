from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog, Product, StockMovement


async def on_hand(db: AsyncSession, product_id: int) -> int:
    stmt = select(func.coalesce(func.sum(StockMovement.qty_delta), 0)).where(
        StockMovement.product_id == product_id
    )
    return int((await db.execute(stmt)).scalar_one())


async def on_hand_map(db: AsyncSession, product_ids: list[int] | None = None) -> dict[int, int]:
    stmt = select(
        StockMovement.product_id, func.coalesce(func.sum(StockMovement.qty_delta), 0)
    ).group_by(StockMovement.product_id)
    if product_ids is not None:
        stmt = stmt.where(StockMovement.product_id.in_(product_ids))
    rows = (await db.execute(stmt)).all()
    return {pid: int(total) for pid, total in rows}


async def apply_movement(
    db: AsyncSession,
    *,
    product_id: int,
    qty_delta: int,
    type_: str = "adjustment",
    reason: str | None = None,
    user_id: int | None = None,
    actor: str = "system",
    commit: bool = True,
) -> StockMovement:
    product = await db.get(Product, product_id)
    if product is None:
        raise LookupError(f"Product {product_id} not found")

    if qty_delta < 0:
        current = await on_hand(db, product_id)
        if current + qty_delta < 0:
            raise ValueError(
                f"Insufficient stock for product {product_id}: on hand {current}, "
                f"requested change {qty_delta}"
            )

    mv = StockMovement(
        product_id=product_id, type=type_, qty_delta=qty_delta, reason=reason, user_id=user_id
    )
    db.add(mv)
    db.add(
        AuditLog(
            actor=actor,
            action="stock_movement",
            entity=f"product:{product_id}",
            detail={"type": type_, "qty_delta": qty_delta, "reason": reason},
        )
    )
    if commit:
        await db.commit()
        await db.refresh(mv)
    else:
        await db.flush()
    return mv


async def low_stock(db: AsyncSession) -> list[dict]:
    products = (await db.execute(select(Product))).scalars().all()
    levels = await on_hand_map(db, [p.id for p in products])
    out = []
    for p in products:
        oh = levels.get(p.id, 0)
        if oh <= p.reorder_point:
            out.append(
                {
                    "product_id": p.id,
                    "sku": p.sku,
                    "name": p.name,
                    "on_hand": oh,
                    "reorder_point": p.reorder_point,
                    "below_reorder": True,
                }
            )
    return out
