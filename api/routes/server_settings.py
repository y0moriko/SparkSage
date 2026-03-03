from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from api.deps import get_current_user
import db

router = APIRouter()

class GuildConfigUpdate(BaseModel):
    welcome_enabled: bool | None = None
    welcome_channel_id: str | None = None
    welcome_message: str | None = None
    digest_enabled: bool | None = None
    digest_channel_id: str | None = None
    digest_time: str | None = None
    moderation_enabled: bool | None = None
    mod_log_channel_id: str | None = None
    moderation_sensitivity: str | None = None
    faq_channel_id: str | None = None

@router.get("/{guild_id}")
async def get_server_settings(guild_id: str, user: dict = Depends(get_current_user)):
    config = await db.get_guild_config(guild_id)
    if not config:
        # Return default structure if no config exists yet
        return {
            "guild_id": guild_id,
            "welcome_enabled": False,
            "welcome_channel_id": "",
            "welcome_message": "Welcome {user} to {server}!",
            "digest_enabled": False,
            "digest_channel_id": "",
            "digest_time": "09:00",
            "moderation_enabled": False,
            "mod_log_channel_id": "",
            "moderation_sensitivity": "medium",
            "faq_channel_id": ""
        }
    return config

@router.put("/{guild_id}")
async def update_server_settings(guild_id: str, body: GuildConfigUpdate, user: dict = Depends(get_current_user)):
    # Get existing config to merge
    current = await db.get_guild_config(guild_id) or {}
    
    # Merge new values
    update_data = body.dict(exclude_unset=True)
    merged = {**current, **update_data}
    
    await db.set_guild_config(guild_id, merged)
    return {"status": "ok"}
