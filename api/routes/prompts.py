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
async def list_channel_providers(user: dict = Depends(get_current_user)):
    providers = await db.list_channel_providers()
    return {"providers": providers}

@router.post("/providers")
async def set_channel_provider(body: ChannelProviderUpdate, user: dict = Depends(get_current_user)):
    await db.set_channel_provider(body.channel_id, body.guild_id, body.provider_name)
    return {"status": "ok"}

@router.delete("/providers/{channel_id}")
async def delete_channel_provider(channel_id: str, user: dict = Depends(get_current_user)):
    await db.delete_channel_provider(channel_id)
    return {"status": "ok"}

# --- Custom Commands ---

class CustomCommandCreate(BaseModel):
    name: str
    description: str
    prompt: str
    requires_input: bool = True

@router.get("/custom")
async def list_custom_commands(user: dict = Depends(get_current_user)):
    commands = await db.get_custom_commands()
    return {"commands": commands}

@router.post("/custom")
async def add_custom_command(body: CustomCommandCreate, user: dict = Depends(get_current_user)):
    # Clean name (no spaces, lowercase)
    name = body.name.lower().replace(" ", "_")
    await db.add_custom_command(name, body.description, body.prompt, body.requires_input)
    return {"status": "ok", "name": name}

@router.delete("/custom/{name}")
async def delete_custom_command(name: str, user: dict = Depends(get_current_user)):
    await db.delete_custom_command(name)
    return {"status": "ok"}
