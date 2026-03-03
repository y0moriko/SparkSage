from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from api.deps import get_current_user
import db
from plugins.loader import get_all_plugins, load_plugin, unload_plugin

router = APIRouter()

class PluginStatusUpdate(BaseModel):
    id: str
    enabled: bool

@router.get("")
async def list_plugins(user: dict = Depends(get_current_user)):
    """Return all discovered plugins and their status."""
    plugins = await get_all_plugins()
    return {"plugins": plugins}

@router.put("/status")
async def update_plugin_status(body: PluginStatusUpdate, user: dict = Depends(get_current_user)):
    """Enable or disable a plugin at runtime."""
    from bot import bot
    
    # Update DB first
    await db.set_plugin_status(body.id, body.enabled)
    
    # Try to load/unload in real-time
    if body.enabled:
        success, message = await load_plugin(bot, body.id)
    else:
        success, message = await unload_plugin(bot, body.id)
    
    if success:
        # Sync the command tree so the new commands appear in Discord
        # Run in bot's loop to avoid "Timeout context manager should be used inside a task"
        bot.loop.create_task(bot.tree.sync())
    else:
        # Revert DB if bot operation failed
        await db.set_plugin_status(body.id, not body.enabled)
        raise HTTPException(status_code=400, detail=message)
        
    return {"status": "ok", "message": message}
