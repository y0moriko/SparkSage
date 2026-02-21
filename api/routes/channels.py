from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from api.deps import get_current_user
import db

router = APIRouter()

class ChannelOverrideUpdate(BaseModel):
    channel_id: str
    system_prompt: str | None = None
    provider_name: str | None = None

@router.get("/overrides")
async def list_overrides(user: dict = Depends(get_current_user)):
    overrides = await db.list_channel_overrides()
    return {"overrides": overrides}

@router.post("/overrides")
async def set_override(body: ChannelOverrideUpdate, user: dict = Depends(get_current_user)):
    await db.set_channel_override(body.channel_id, body.system_prompt, body.provider_name)
    return {"status": "ok"}

@router.delete("/overrides/{channel_id}")
async def delete_override(channel_id: str, user: dict = Depends(get_current_user)):
    await db.delete_channel_override(channel_id)
    return {"status": "ok"}
