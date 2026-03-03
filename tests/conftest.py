import pytest
import os
import asyncio
import aiosqlite
import pytest_asyncio
from httpx import AsyncClient
from typing import AsyncGenerator

# Set test environment
os.environ["DATABASE_PATH"] = ":memory:"
os.environ["JWT_SECRET"] = "test-secret"
os.environ["ADMIN_PASSWORD"] = "test-password"

import db
import config
from api.main import create_app

@pytest_asyncio.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    """Initialize in-memory database for each test."""
    # Reset the connection cache
    import db
    db._db_connections = {}
    
    conn = await db.get_db()
    await db.init_db()
    # Seed config from env defaults
    await db.sync_env_to_db()
    # Force overwrite admin password for tests
    await db.set_config("ADMIN_PASSWORD", "test-password")
    yield conn
    await conn.close()

@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Test client for API endpoints."""
    from httpx import ASGITransport
    app = create_app()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

@pytest_asyncio.fixture
async def auth_token(client: AsyncClient) -> str:
    """Helper to get a valid admin token."""
    resp = await client.post("/api/auth/login", json={"password": "test-password"})
    return resp.json()["access_token"]
