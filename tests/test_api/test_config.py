import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_get_config(client: AsyncClient, auth_token: str):
    headers = {"Authorization": f"Bearer {auth_token}"}
    resp = await client.get("/api/config", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "config" in data
    assert "BOT_PREFIX" in data["config"]

@pytest.mark.asyncio
async def test_update_config(client: AsyncClient, auth_token: str):
    headers = {"Authorization": f"Bearer {auth_token}"}
    payload = {"values": {"BOT_PREFIX": "?"}}
    resp = await client.put("/api/config", headers=headers, json=payload)
    assert resp.status_code == 200
    
    # Verify update
    get_resp = await client.get("/api/config", headers=headers)
    assert get_resp.json()["config"]["BOT_PREFIX"] == "?"
