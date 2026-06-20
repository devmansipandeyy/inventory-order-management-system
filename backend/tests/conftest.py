import os
import tempfile

_TMP_DB = os.path.join(tempfile.gettempdir(), "ethara_test_inventory.db")
if os.path.exists(_TMP_DB):
    os.remove(_TMP_DB)

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{_TMP_DB}"
os.environ["SEED_ON_STARTUP"] = "false"
os.environ["OPENAI_API_KEY"] = ""
os.environ["JWT_SECRET"] = "test-secret"

import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.core.database import init_models
from app.main import app


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _create_tables():
    await init_models()
    yield


@pytest_asyncio.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def auth_client(client):
    import uuid

    email = f"user-{uuid.uuid4().hex[:8]}@test.io"
    r = await client.post("/auth/register", json={"email": email, "password": "secret123", "name": "T"})
    token = r.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"
    return client
