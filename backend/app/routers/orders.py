from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models import Order, User
from app.schemas import OrderIn, OrderOut
from app.services import orders as order_svc

router = APIRouter(prefix="/orders", tags=["orders"])


@router.get("", response_model=list[OrderOut])
async def list_orders(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    return (await db.execute(select(Order).order_by(desc(Order.created_at)))).scalars().all()


@router.post("", response_model=OrderOut, status_code=201)
async def create_order(body: OrderIn, db: AsyncSession = Depends(get_db),
                       user: User = Depends(get_current_user)):
    try:
        order = await order_svc.create_order(
            db, customer_id=body.customer_id,
            lines=[ln.model_dump() for ln in body.lines],
            user_id=user.id, actor=user.email,
        )
    except order_svc.OrderError as e:
        raise HTTPException(400, str(e))
    return order


@router.get("/{order_id}", response_model=OrderOut)
async def get_order(order_id: int, db: AsyncSession = Depends(get_db),
                    user: User = Depends(get_current_user)):
    order = await db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    return order


@router.delete("/{order_id}", status_code=204)
async def delete_order(order_id: int, db: AsyncSession = Depends(get_db),
                       user: User = Depends(get_current_user)):
    try:
        await order_svc.cancel_order(db, order_id=order_id, user_id=user.id, actor=user.email)
    except order_svc.OrderError as e:
        raise HTTPException(404, str(e))
