from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PurchaseOrder, PurchaseOrderLine, User
from app.core.database import get_db
from app.core.deps import get_current_user
from app.schemas import POIn, POOut
from app.services import stock as stock_svc

router = APIRouter(prefix="/purchase-orders", tags=["purchase-orders"])


@router.get("", response_model=list[POOut])
async def list_pos(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    return (await db.execute(select(PurchaseOrder).order_by(desc(PurchaseOrder.created_at)))).scalars().all()


@router.post("", response_model=POOut, status_code=201)
async def create_po(body: POIn, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    if not body.lines:
        raise HTTPException(422, "Purchase order needs at least one line")
    po = PurchaseOrder(
        supplier_id=body.supplier_id, status="ordered",
        created_by=user.id, expected_at=body.expected_at,
    )
    po.lines = [
        PurchaseOrderLine(product_id=ln.product_id, qty=ln.qty, unit_cost=ln.unit_cost)
        for ln in body.lines
    ]
    db.add(po)
    await db.commit()
    await db.refresh(po)
    return po


@router.get("/{po_id}", response_model=POOut)
async def get_po(po_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    po = await db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(404, "Purchase order not found")
    return po


@router.post("/{po_id}/receive", response_model=POOut)
async def receive_po(po_id: int, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    po = await db.get(PurchaseOrder, po_id)
    if not po:
        raise HTTPException(404, "Purchase order not found")
    if po.status == "received":
        raise HTTPException(409, "Purchase order already received")
    for ln in po.lines:
        await stock_svc.apply_movement(
            db, product_id=ln.product_id, qty_delta=ln.qty, type_="purchase",
            reason=f"PO #{po.id} received", user_id=user.id, actor=user.email, commit=False,
        )
    po.status = "received"
    await db.commit()
    await db.refresh(po)
    return po
