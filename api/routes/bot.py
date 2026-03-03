from fastapi import APIRouter, Depends
from api.deps import get_current_user
import os
import signal

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


@router.get("/guilds/{guild_id}/roles")
async def guild_roles(guild_id: str, user: dict = Depends(get_current_user)):
    print(f"DEBUG: API request for roles in guild {guild_id}")
    from bot import get_guild_roles
    roles = get_guild_roles(guild_id)
    return {"roles": roles}


@router.post("/restart")
async def restart_bot(user: dict = Depends(get_current_user)):
    """Restart the entire application (API + Bot).
    This depends on the application being run by a process manager or a script that restarts on exit.
    """
    # Use a small delay to allow the response to be sent
    import threading
    import time

    def kill_later():
        time.sleep(1)
        # On Windows, we can't easily 'exec', so we just exit and let the wrapper restart us
        os._exit(0)

    threading.Thread(target=kill_later).start()
    return {"status": "restarting"}
