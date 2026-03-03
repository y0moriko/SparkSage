from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from api.deps import get_current_user
import db

router = APIRouter()

class PermissionUpdate(BaseModel):
    command_name: str
    guild_id: str
    role_id: str

@router.get("/{guild_id}")
async def list_permissions(guild_id: str, user: dict = Depends(get_current_user)):
    perms = await db.get_guild_permissions(guild_id)
    return {"permissions": perms}

@router.post("/")
async def add_permission(body: PermissionUpdate, user: dict = Depends(get_current_user)):
    await db.add_command_permission(body.command_name, body.guild_id, body.role_id)
    return {"status": "ok"}

@router.delete("/")
async def remove_permission(command_name: str, guild_id: str, role_id: str, user: dict = Depends(get_current_user)):
    await db.remove_command_permission(command_name, guild_id, role_id)
    return {"status": "ok"}
