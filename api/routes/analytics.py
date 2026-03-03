from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from api.deps import get_current_user
import db
from utils.rate_limiter import limiter

router = APIRouter()


@router.get("/summary")
async def get_analytics_summary(
    guild_id: str | None = Query(None),
    user: dict = Depends(get_current_user)
):
    """Get summarized analytics for the dashboard charts."""
    summary = await db.get_analytics_summary(guild_id=guild_id)
    return summary


@router.get("/usage")
async def get_current_usage(
    guild_id: str | None = Query(None),
    user: dict = Depends(get_current_user)
):
    """Get current rate limit usage for monitoring."""
    user_usage = {uid: len(hits) for uid, hits in limiter.user_hits.items() if len(hits) > 0}
    
    # Filter guild usage if requested
    if guild_id:
        guild_usage = {guild_id: len(limiter.guild_hits.get(guild_id, []))}
    else:
        guild_usage = {gid: len(hits) for gid, hits in limiter.guild_hits.items() if len(hits) > 0}
        
    return {
        "user_usage": user_usage,
        "guild_usage": guild_usage
    }


@router.get("/costs")
async def get_cost_analytics(user: dict = Depends(get_current_user)):
    """Get summarized cost analytics for the dashboard."""
    costs = await db.get_cost_summary()
    return costs


@router.get("/history")
async def get_analytics_history(
    limit: int = Query(100, ge=1, le=500),
    guild_id: str | None = Query(None),
    user: dict = Depends(get_current_user)
):
    """Get detailed analytics event history."""
    history = await db.get_analytics_history(limit=limit, guild_id=guild_id)
    return {"history": history}
