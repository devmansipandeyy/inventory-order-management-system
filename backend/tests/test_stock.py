import asyncio

import pytest
from sqlalchemy.exc import OperationalError

from app.core.database import SessionLocal
from app.models import Product
from app.services import stock as stock_svc


async def _make_product(sku: str) -> int:
    async with SessionLocal() as db:
        p = Product(sku=sku, name=f"P {sku}", unit_price=1, cost_price=1)
        db.add(p)
        await db.commit()
        await db.refresh(p)
        return p.id


async def _movement_with_retry(product_id: int, delta: int):
    for _ in range(10):
        try:
            async with SessionLocal() as db:
                await stock_svc.apply_movement(db, product_id=product_id, qty_delta=delta)
            return
        except OperationalError:
            await asyncio.sleep(0.05)
    raise RuntimeError("movement kept failing")


@pytest.mark.asyncio
async def test_on_hand_is_sum_of_movements():
    pid = await _make_product("CONC-SUM")
    async with SessionLocal() as db:
        await stock_svc.apply_movement(db, product_id=pid, qty_delta=100, type_="purchase")
        await stock_svc.apply_movement(db, product_id=pid, qty_delta=-30, type_="sale")
    async with SessionLocal() as db:
        assert await stock_svc.on_hand(db, pid) == 70


@pytest.mark.asyncio
async def test_concurrent_movements_lose_nothing():
    pid = await _make_product("CONC-RACE")
    await asyncio.gather(*[_movement_with_retry(pid, 1) for _ in range(25)])
    async with SessionLocal() as db:
        assert await stock_svc.on_hand(db, pid) == 25
