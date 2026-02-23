from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from api.deps import get_current_user
import db

router = APIRouter()

class ChannelPromptUpdate(BaseModel):
    channel_id: str
    guild_id: str
    system_prompt: str

class ChannelProviderUpdate(BaseModel):
    channel_id: str
    guild_id: str
    provider_name: str

@router.get("/prompts")
async def list_prompts(user: dict = Depends(get_current_user)):
    prompts = await db.list_channel_prompts()
    return {"prompts": prompts}

@router.post("/prompts")
async def set_prompt(body: ChannelPromptUpdate, user: dict = Depends(get_current_user)):
    await db.set_channel_prompt(body.channel_id, body.guild_id, body.system_prompt)
    return {"status": "ok"}

@router.delete("/prompts/{channel_id}")
async def delete_prompt(channel_id: str, user: dict = Depends(get_current_user)):
    await db.delete_channel_prompt(channel_id)
    return {"status": "ok"}

@router.get("/providers")
async def list_providers(user: dict = Depends(get_current_user)):
    providers = await db.list_channel_providers()
    return {"providers": providers}

@router.post("/providers")
async def set_provider(body: ChannelProviderUpdate, user: dict = Depends(get_current_user)):
    await db.set_channel_provider(body.channel_id, body.guild_id, body.provider_name)
    return {"status": "ok"}

@router.delete("/providers/{channel_id}")
async def delete_provider(channel_id: str, user: dict = Depends(get_current_user)):
    await db.delete_channel_provider(channel_id)
    return {"status": "ok"}
