import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_list_providers(client: AsyncClient, auth_token: str):
    headers = {"Authorization": f"Bearer {auth_token}"}
    resp = await client.get("/api/providers", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "providers" in data
    assert "fallback_order" in data

@pytest.mark.asyncio
async def test_set_primary_provider(client: AsyncClient, auth_token: str):
    headers = {"Authorization": f"Bearer {auth_token}"}
    payload = {"provider": "groq"}
    resp = await client.put("/api/providers/primary", headers=headers, json=payload)
    assert resp.status_code == 200
    assert resp.json()["primary"] == "groq"
