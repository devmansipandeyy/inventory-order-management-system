import uuid

import pytest


async def _new_customer(client, email=None):
    email = email or f"cust-{uuid.uuid4().hex[:8]}@example.com"
    r = await client.post("/customers", json={"full_name": "Test C", "email": email, "phone": "1"})
    return r


async def _new_product(client, on_hand: int):
    sku = f"ORD-{uuid.uuid4().hex[:6]}"
    r = await client.post("/products", json={"sku": sku, "name": "Orderable", "unit_price": 10.0})
    pid = r.json()["id"]
    if on_hand:
        await client.post("/stock/movements",
                          json={"product_id": pid, "type": "purchase", "qty_delta": on_hand})
    return pid


@pytest.mark.asyncio
async def test_customer_crud_and_unique_email(auth_client):
    email = f"dup-{uuid.uuid4().hex[:8]}@example.com"
    a = await _new_customer(auth_client, email)
    b = await _new_customer(auth_client, email)
    assert a.status_code == 201
    assert b.status_code == 409


@pytest.mark.asyncio
async def test_order_reduces_stock_and_computes_total(auth_client):
    cust = (await _new_customer(auth_client)).json()
    pid = await _new_product(auth_client, on_hand=20)

    r = await auth_client.post("/orders", json={"customer_id": cust["id"],
                                                "lines": [{"product_id": pid, "qty": 3}]})
    assert r.status_code == 201
    body = r.json()
    assert body["total_amount"] == 30.0
    prod = await auth_client.get(f"/products/{pid}")
    assert prod.json()["on_hand"] == 17


@pytest.mark.asyncio
async def test_order_blocked_when_inventory_insufficient(auth_client):
    cust = (await _new_customer(auth_client)).json()
    pid = await _new_product(auth_client, on_hand=2)

    r = await auth_client.post("/orders", json={"customer_id": cust["id"],
                                                "lines": [{"product_id": pid, "qty": 5}]})
    assert r.status_code == 400
    assert "insufficient" in r.json()["detail"].lower()
    prod = await auth_client.get(f"/products/{pid}")
    assert prod.json()["on_hand"] == 2


@pytest.mark.asyncio
async def test_cancel_order_restores_stock(auth_client):
    cust = (await _new_customer(auth_client)).json()
    pid = await _new_product(auth_client, on_hand=10)
    order = (await auth_client.post("/orders", json={"customer_id": cust["id"],
                                                     "lines": [{"product_id": pid, "qty": 4}]})).json()
    assert (await auth_client.get(f"/products/{pid}")).json()["on_hand"] == 6
    d = await auth_client.delete(f"/orders/{order['id']}")
    assert d.status_code == 204
    assert (await auth_client.get(f"/products/{pid}")).json()["on_hand"] == 10


@pytest.mark.asyncio
async def test_stock_cannot_go_negative(auth_client):
    pid = await _new_product(auth_client, on_hand=5)
    r = await auth_client.post("/stock/movements",
                               json={"product_id": pid, "type": "sale", "qty_delta": -9})
    assert r.status_code == 400
    assert (await auth_client.get(f"/products/{pid}")).json()["on_hand"] == 5
