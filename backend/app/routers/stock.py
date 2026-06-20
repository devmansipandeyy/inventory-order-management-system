from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import Product, StockMovement, User
from app.schemas import MovementIn, MovementOut, StockLevel
from app.services import stock as stock_svc

router = APIRouter(prefix="/stock", tags=["stock"])


@router.post("/movements", response_model=MovementOut, status_code=201)
async def create_movement(
    body: MovementIn,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    try:
        mv = await stock_svc.apply_movement(
            db, product_id=body.product_id, qty_delta=body.qty_delta,
            type_=body.type, reason=body.reason, user_id=user.id, actor=user.email,
        )
    except LookupError as e:
        raise HTTPException(404, str(e))
    except ValueError as e:
        raise HTTPException(400, str(e))
    return mv


@router.get("/movements", response_model=list[MovementOut])
async def list_movements(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    product_id: int | None = None,
    limit: int = 100,
):
    stmt = select(StockMovement).order_by(desc(StockMovement.created_at)).limit(limit)
    if product_id is not None:
        stmt = stmt.where(StockMovement.product_id == product_id)
    return (await db.execute(stmt)).scalars().all()


@router.get("/levels", response_model=list[StockLevel])
async def levels(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    products = (await db.execute(select(Product))).scalars().all()
    on_hand = await stock_svc.on_hand_map(db, [p.id for p in products])
    return [
        StockLevel(
            product_id=p.id, sku=p.sku, name=p.name,
            on_hand=on_hand.get(p.id, 0), reorder_point=p.reorder_point,
            below_reorder=on_hand.get(p.id, 0) <= p.reorder_point,
        )
        for p in products
    ]
