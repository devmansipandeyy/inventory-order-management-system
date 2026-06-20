from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.prompts import DEFAULT_PROMPT_NAME, DEFAULT_SYSTEM_PROMPT
from app.core.security import hash_password
from app.models import (
    Category, Customer, Product, PromptVersion, StockMovement, Supplier, User,
)

DEMO_PRODUCTS = [
    ("SKU-1001", "USB-C Cable 2m", "Electronics", 9.99, 4.0, 30, 100, 106),
    ("SKU-1002", "Wireless Mouse", "Electronics", 24.99, 12.0, 20, 60, 28),
    ("SKU-1003", "Mechanical Keyboard", "Electronics", 79.99, 45.0, 15, 40, 76),
    ("SKU-1004", "HDMI Cable 1.5m", "Electronics", 7.49, 3.0, 40, 120, 34),
    ("SKU-1005", "Laptop Stand", "Accessories", 34.99, 18.0, 10, 30, 46),
    ("SKU-1006", "Notebook A5", "Stationery", 4.99, 1.5, 50, 200, 136),
    ("SKU-1007", "Gel Pen (pack of 5)", "Stationery", 6.99, 2.0, 40, 150, 34),
    ("SKU-1008", "Desk Lamp LED", "Accessories", 29.99, 14.0, 12, 40, 22),
    ("SKU-1009", "Webcam 1080p", "Electronics", 49.99, 26.0, 15, 50, 71),
    ("SKU-1010", "Monitor 24in", "Electronics", 159.99, 95.0, 8, 20, 30),
    ("SKU-1011", "Cable Organizer", "Accessories", 12.99, 5.0, 25, 80, 16),
    ("SKU-1012", "Sticky Notes", "Stationery", 3.49, 1.0, 60, 250, 216),
]


async def seed(db: AsyncSession) -> None:
    if (await db.execute(select(func.count(User.id)))).scalar_one() > 0:
        return

    db.add(User(email="admin@ethara.ai", password_hash=hash_password("admin123"),
                name="Admin", role="admin"))
    db.add(User(email="staff@ethara.ai", password_hash=hash_password("staff123"),
                name="Staff", role="staff"))

    cat_names = {p[2] for p in DEMO_PRODUCTS}
    cats = {name: Category(name=name, description=f"{name} products") for name in cat_names}
    for c in cats.values():
        db.add(c)

    sup = Supplier(name="Acme Supplies", email="sales@acme.test", phone="+91-99999-00000",
                   address="Gurugram, HR", lead_time_days=5)
    sup2 = Supplier(name="Global Traders", email="hello@globaltraders.test", lead_time_days=10)
    db.add_all([sup, sup2])
    await db.flush()

    products: list[tuple[Product, int]] = []
    for sku, name, cat, price, cost, rp, rq, stock0 in DEMO_PRODUCTS:
        p = Product(sku=sku, name=name, description=f"{name} - demo item",
                    category_id=cats[cat].id, supplier_id=sup.id,
                    unit_price=price, cost_price=cost, reorder_point=rp, reorder_qty=rq)
        db.add(p)
        products.append((p, stock0))
    await db.flush()

    now = datetime.now(timezone.utc)
    for p, stock0 in products:
        if stock0 > 0:
            db.add(StockMovement(product_id=p.id, type="purchase", qty_delta=stock0,
                                 reason="Opening stock", created_at=now - timedelta(days=30)))
        for week, qty in enumerate([3, 4, 4, 5]):
            db.add(StockMovement(product_id=p.id, type="sale", qty_delta=-qty,
                                 reason="Demo sale", created_at=now - timedelta(days=21 - week * 7)))

    db.add(PromptVersion(name=DEFAULT_PROMPT_NAME, content=DEFAULT_SYSTEM_PROMPT, is_active=True))

    cust1 = Customer(full_name="Riya Sharma", email="riya@example.com", phone="+91-90000-11111")
    cust2 = Customer(full_name="Arjun Mehta", email="arjun@example.com", phone="+91-90000-22222")
    db.add_all([cust1, cust2])
    await db.commit()

    from app.services.orders import create_order
    sku_to_id = {p.sku: p.id for p, _ in products}
    await create_order(
        db, customer_id=cust1.id,
        lines=[{"product_id": sku_to_id["SKU-1001"], "qty": 2},
               {"product_id": sku_to_id["SKU-1003"], "qty": 1}],
        user_id=None, actor="seed",
    )
