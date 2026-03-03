import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_wizard_status(client: AsyncClient):
    # Public endpoint
    resp = await client.get("/api/wizard/status")
    assert resp.status_code == 200
    assert "completed" in resp.json()

@pytest.mark.asyncio
async def test_complete_wizard(client: AsyncClient, auth_token: str):
    headers = {"Authorization": f"Bearer {auth_token}"}
    payload = {
        "config": {
            "DISCORD_TOKEN": "test-token-1234567890-test-token-1234567890",
            "AI_PROVIDER": "groq"
        }
    }
    resp = await client.post("/api/wizard/complete", headers=headers, json=payload)
    assert resp.status_code == 200
    
    # Verify wizard is now completed
    status_resp = await client.get("/api/wizard/status")
    assert status_resp.json()["completed"] is True
