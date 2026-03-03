from __future__ import annotations
import time
import config
from collections import defaultdict

class RateLimiter:
    def __init__(self):
        # Maps key (user_id or guild_id) to a list of timestamps
        self.user_hits = defaultdict(list)
        self.guild_hits = defaultdict(list)

    def _is_limited(self, key: str, hits_dict: dict, limit: int, window: int = 60) -> tuple[bool, int]:
        """
        Generic sliding window rate limiter.
        Returns (is_limited, retry_after_seconds).
        """
        now = time.time()
        
        # Clean up old timestamps outside the window
        hits_dict[key] = [t for t in hits_dict[key] if now - t < window]
        
        if len(hits_dict[key]) >= limit:
            # Calculate when the oldest hit will expire
            retry_after = int(window - (now - hits_dict[key][0]))
            return True, max(1, retry_after)
        
        # Add current hit
        hits_dict[key].append(now)
        return False, 0

    def check_user(self, user_id: str) -> tuple[bool, int]:
        """Check if a user is rate limited."""
        return self._is_limited(user_id, self.user_hits, config.RATE_LIMIT_USER)

    def check_guild(self, guild_id: str | None) -> tuple[bool, int]:
        """Check if a guild is rate limited."""
        if not guild_id:
            return False, 0
        return self._is_limited(guild_id, self.guild_hits, config.RATE_LIMIT_GUILD)

# Global instance
limiter = RateLimiter()
