import pytest

from app.ai.agent import resolve_action
from app.core.database import SessionLocal
from app.models import PendingAction, Product, User
from app.services import stock as stock_svc


async def _setup(sku: str):
    async with SessionLocal() as db:
        user = User(email=f"agent-{sku}@test.io", password_hash="x", name="A", role="staff")
        product = Product(sku=sku, name="Widget", unit_price=1, cost_price=1)
        db.add_all([user, product])
        await db.commit()
        await db.refresh(user)
        await db.refresh(product)
        return user.id, product.id


async def _pending(session_id: str, sku: str, delta: int, user_id: int) -> int:
    async with SessionLocal() as db:
        pa = PendingAction(session_id=session_id, tool_name="adjust_stock",
                           args={"sku": sku, "qty_delta": delta, "reason": "test"},
                           status="pending", created_by=user_id)
        db.add(pa)
        await db.commit()
        await db.refresh(pa)
        return pa.id


@pytest.mark.asyncio
async def test_confirm_executes_the_write():
    user_id, pid = await _setup("CONFIRM-1")
    action_id = await _pending("s1", "CONFIRM-1", 40, user_id)
    async with SessionLocal() as db:
        user = await db.get(User, user_id)
        res = await resolve_action(db, action_id, "confirm", user)
    assert res["status"] == "executed"
    async with SessionLocal() as db:
        assert await stock_svc.on_hand(db, pid) == 40


@pytest.mark.asyncio
async def test_reject_does_not_mutate():
    user_id, pid = await _setup("REJECT-1")
    action_id = await _pending("s2", "REJECT-1", 40, user_id)
    async with SessionLocal() as db:
        user = await db.get(User, user_id)
        res = await resolve_action(db, action_id, "reject", user)
    assert res["status"] == "rejected"
    async with SessionLocal() as db:
        assert await stock_svc.on_hand(db, pid) == 0


@pytest.mark.asyncio
async def test_double_confirm_is_guarded():
    user_id, pid = await _setup("DOUBLE-1")
    action_id = await _pending("s3", "DOUBLE-1", 10, user_id)
    async with SessionLocal() as db:
        user = await db.get(User, user_id)
        first = await resolve_action(db, action_id, "confirm", user)
        second = await resolve_action(db, action_id, "confirm", user)
    assert first["status"] == "executed"
    assert second["status"] == "executed"
    async with SessionLocal() as db:
        assert await stock_svc.on_hand(db, pid) == 10
