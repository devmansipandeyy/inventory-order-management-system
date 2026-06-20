from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog, Customer, Order, OrderLine, Product
from app.services import stock as stock_svc


class OrderError(ValueError):
    pass


async def create_order(db: AsyncSession, *, customer_id: int, lines: list[dict],
                       user_id: int | None, actor: str) -> Order:
    customer = await db.get(Customer, customer_id)
    if customer is None:
        raise OrderError(f"Customer {customer_id} not found")
    if not lines:
        raise OrderError("Order must contain at least one line")

    resolved: list[tuple[Product, int]] = []
    for ln in lines:
        product = await db.get(Product, ln["product_id"])
        if product is None:
            raise OrderError(f"Product {ln['product_id']} not found")
        qty = int(ln["qty"])
        if qty <= 0:
            raise OrderError("Quantity must be positive")
        available = await stock_svc.on_hand(db, product.id)
        if qty > available:
            raise OrderError(
                f"Insufficient inventory for {product.sku}: requested {qty}, available {available}"
            )
        resolved.append((product, qty))

    total = round(sum(p.unit_price * qty for p, qty in resolved), 2)
    order = Order(customer_id=customer_id, status="placed", total_amount=total, created_by=user_id)
    order.lines = [OrderLine(product_id=p.id, qty=qty, unit_price=p.unit_price)
                   for p, qty in resolved]
    db.add(order)
    await db.flush()

    for p, qty in resolved:
        await stock_svc.apply_movement(
            db, product_id=p.id, qty_delta=-qty, type_="sale",
            reason=f"Order #{order.id}", user_id=user_id, actor=actor, commit=False,
        )

    db.add(AuditLog(actor=actor, action="order_created", entity=f"order:{order.id}",
                    detail={"customer_id": customer_id, "total": total, "lines": len(resolved)}))
    await db.commit()
    await db.refresh(order)
    return order


async def cancel_order(db: AsyncSession, *, order_id: int, user_id: int | None,
                       actor: str) -> None:
    order = await db.get(Order, order_id)
    if order is None:
        raise OrderError(f"Order {order_id} not found")

    if order.status != "cancelled":
        for ln in order.lines:
            await stock_svc.apply_movement(
                db, product_id=ln.product_id, qty_delta=ln.qty, type_="return",
                reason=f"Order #{order.id} cancelled", user_id=user_id, actor=actor, commit=False,
            )
        db.add(AuditLog(actor=actor, action="order_cancelled", entity=f"order:{order.id}",
                        detail={"restored_lines": len(order.lines)}))

    await db.delete(order)
    await db.commit()
