from fastapi import APIRouter, Depends
from api.deps import get_current_user

router = APIRouter()


@router.get("/status")
async def bot_status(user: dict = Depends(get_current_user)):
    from bot import get_bot_status
    return get_bot_status()


@router.get("/guilds/{guild_id}/channels")
async def guild_channels(guild_id: str, user: dict = Depends(get_current_user)):
    from bot import get_guild_channels
    channels = get_guild_channels(guild_id)
    return {"channels": channels}
