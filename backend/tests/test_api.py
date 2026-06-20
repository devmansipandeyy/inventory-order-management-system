import io
import uuid

import pytest


@pytest.mark.asyncio
async def test_auth_flow_and_protected_route(client):
    email = f"flow-{uuid.uuid4().hex[:8]}@test.io"
    r = await client.post("/auth/register", json={"email": email, "password": "secret123", "name": "F"})
    assert r.status_code == 200
    token = r.json()["access_token"]

    assert (await client.get("/products")).status_code in (401, 403)

    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200 and me.json()["email"] == email

    bad = await client.get("/auth/me", headers={"Authorization": "Bearer not-a-token"})
    assert bad.status_code == 401


@pytest.mark.asyncio
async def test_product_create_movement_and_derived_on_hand(auth_client):
    sku = f"API-{uuid.uuid4().hex[:6]}"
    r = await auth_client.post("/products", json={"sku": sku, "name": "API Widget", "cost_price": 2.0})
    assert r.status_code == 201
    pid = r.json()["id"]
    assert r.json()["on_hand"] == 0

    await auth_client.post("/stock/movements", json={"product_id": pid, "type": "purchase", "qty_delta": 50})
    await auth_client.post("/stock/movements", json={"product_id": pid, "type": "sale", "qty_delta": -8})

    got = await auth_client.get(f"/products/{pid}")
    assert got.json()["on_hand"] == 42


@pytest.mark.asyncio
async def test_duplicate_sku_rejected(auth_client):
    sku = f"DUP-{uuid.uuid4().hex[:6]}"
    a = await auth_client.post("/products", json={"sku": sku, "name": "One"})
    b = await auth_client.post("/products", json={"sku": sku, "name": "Two"})
    assert a.status_code == 201 and b.status_code == 409


@pytest.mark.asyncio
async def test_csv_import_bad_row_commits_nothing(auth_client):
    csv_body = "sku,name,unit_price\nGOODSKU1,Good,1.5\nBADSKU1,Bad,notanumber\n"
    files = {"file": ("p.csv", io.BytesIO(csv_body.encode()), "text/csv")}
    r = await auth_client.post("/products/import", files=files)
    assert r.status_code == 422
    listing = await auth_client.get("/products", params={"q": "GOODSKU1"})
    assert listing.json()["total"] == 0


@pytest.mark.asyncio
async def test_csv_import_happy_path(auth_client):
    csv_body = "sku,name,unit_price,reorder_point\nCSVOK1,Imported A,3.0,5\nCSVOK2,Imported B,4.0,7\n"
    files = {"file": ("p.csv", io.BytesIO(csv_body.encode()), "text/csv")}
    r = await auth_client.post("/products/import", files=files)
    assert r.status_code == 200 and r.json()["imported"] == 2


@pytest.mark.asyncio
async def test_dashboard_summary(auth_client):
    r = await auth_client.get("/dashboard/summary")
    assert r.status_code == 200
    body = r.json()
    assert {"total_skus", "stock_value", "low_stock_count"} <= set(body)


@pytest.mark.asyncio
async def test_ai_disabled_chat_still_responds(auth_client):
    r = await auth_client.post("/ai/chat", json={"session_id": "t1", "message": "hello"})
    assert r.status_code == 200
    assert r.json()["type"] == "message"


@pytest.mark.asyncio
async def test_chat_history_persists_and_clears(auth_client):
    session = f"sess-{uuid.uuid4().hex[:8]}"
    await auth_client.post("/ai/chat", json={"session_id": session, "message": "first message"})
    await auth_client.post("/ai/chat", json={"session_id": session, "message": "second message"})

    history = (await auth_client.get(f"/ai/chat/{session}")).json()
    roles = [m["role"] for m in history]
    assert roles.count("user") == 2
    assert "first message" in [m["content"] for m in history]

    other = (await auth_client.get(f"/ai/chat/sess-different")).json()
    assert other == []

    cleared = await auth_client.delete(f"/ai/chat/{session}")
    assert cleared.status_code == 204
    assert (await auth_client.get(f"/ai/chat/{session}")).json() == []
