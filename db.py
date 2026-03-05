from __future__ import annotations

import os
import json
import asyncio
import aiosqlite

DATABASE_PATH = os.getenv("DATABASE_PATH", "sparksage.db")

# Store connections per event loop to avoid thread/loop conflicts
_db_connections: dict[asyncio.AbstractEventLoop, aiosqlite.Connection] = {}


async def get_db() -> aiosqlite.Connection:
    """Return the shared database connection for the current event loop."""
    loop = asyncio.get_running_loop()
    
    # Check if we have a connection for this loop
    conn = _db_connections.get(loop)
    if conn is None:
        conn = await aiosqlite.connect(DATABASE_PATH)
        conn.row_factory = aiosqlite.Row
        await conn.execute("PRAGMA journal_mode=WAL")
        await conn.execute("PRAGMA foreign_keys=ON")
        _db_connections[loop] = conn
    
    return conn


async def init_db():
    """Create tables if they don't exist."""
    db = await get_db()
    await db.executescript(
        """
        CREATE TABLE IF NOT EXISTS config (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS conversations (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id TEXT    NOT NULL,
            role       TEXT    NOT NULL,
            content    TEXT    NOT NULL,
            provider   TEXT,
            category   TEXT,
            created_at TEXT    NOT NULL DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_conv_channel ON conversations(channel_id);

        CREATE TABLE IF NOT EXISTS sessions (
            token      TEXT PRIMARY KEY,
            user_id    TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            expires_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS wizard_state (
            id           INTEGER PRIMARY KEY CHECK (id = 1),
            completed    INTEGER NOT NULL DEFAULT 0,
            current_step INTEGER NOT NULL DEFAULT 0,
            data         TEXT    NOT NULL DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS faqs (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id       TEXT    NOT NULL,
            question       TEXT    NOT NULL,
            answer         TEXT    NOT NULL,
            match_keywords TEXT    NOT NULL,
            times_used     INTEGER DEFAULT 0,
            created_by     TEXT,
            created_at     TEXT    DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS command_permissions (
            command_name TEXT NOT NULL,
            guild_id     TEXT NOT NULL,
            role_id      TEXT NOT NULL,
            PRIMARY KEY (command_name, guild_id, role_id)
        );

        CREATE TABLE IF NOT EXISTS moderation_events (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id        TEXT    NOT NULL,
            channel_id      TEXT    NOT NULL,
            user_id         TEXT    NOT NULL,
            user_name       TEXT    NOT NULL,
            message_content TEXT    NOT NULL,
            reason          TEXT    NOT NULL,
            severity        TEXT    NOT NULL,
            created_at      TEXT    DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS channel_prompts (
            channel_id    TEXT PRIMARY KEY,
            guild_id      TEXT NOT NULL,
            system_prompt TEXT NOT NULL,
            updated_at    TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS channel_providers (
            channel_id    TEXT PRIMARY KEY,
            guild_id      TEXT NOT NULL,
            provider_name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS analytics (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type   TEXT NOT NULL,
            guild_id     TEXT,
            channel_id   TEXT,
            user_id      TEXT,
            provider     TEXT,
            tokens_used  INTEGER,
            input_tokens INTEGER,
            output_tokens INTEGER,
            estimated_cost REAL,
            latency_ms   INTEGER,
            created_at   TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS guild_config (
            guild_id               TEXT PRIMARY KEY,
            welcome_enabled        INTEGER DEFAULT 0,
            welcome_channel_id     TEXT,
            welcome_message        TEXT,
            digest_enabled         INTEGER DEFAULT 0,
            digest_channel_id      TEXT,
            digest_time            TEXT DEFAULT '09:00',
            moderation_enabled     INTEGER DEFAULT 0,
            mod_log_channel_id     TEXT,
            moderation_sensitivity TEXT DEFAULT 'medium',
            faq_channel_id         TEXT
        );

        CREATE TABLE IF NOT EXISTS plugins (
            name        TEXT PRIMARY KEY,
            enabled     INTEGER DEFAULT 0,
            config_data TEXT DEFAULT '{}'
        );

        CREATE TABLE IF NOT EXISTS custom_commands (
            name            TEXT PRIMARY KEY,
            description     TEXT NOT NULL,
            prompt          TEXT NOT NULL,
            requires_input  INTEGER DEFAULT 1,
            created_at      TEXT DEFAULT (datetime('now'))
        );

        INSERT OR IGNORE INTO wizard_state (id) VALUES (1);
        """
    )
    
    # Migration: Add category column if it doesn't exist
    try:
        await db.execute("ALTER TABLE conversations ADD COLUMN category TEXT")
    except aiosqlite.OperationalError:
        pass # Already exists

    # Migration: Add cost tracking columns to analytics
    for col in ["input_tokens", "output_tokens"]:
        try:
            await db.execute(f"ALTER TABLE analytics ADD COLUMN {col} INTEGER")
        except aiosqlite.OperationalError:
            pass
    try:
        await db.execute("ALTER TABLE analytics ADD COLUMN estimated_cost REAL")
    except aiosqlite.OperationalError:
        pass
        
    # Migration: Add updated_at to channel_prompts
    try:
        await db.execute("ALTER TABLE channel_prompts ADD COLUMN updated_at TEXT")
        await db.execute("UPDATE channel_prompts SET updated_at = datetime('now') WHERE updated_at IS NULL")
    except aiosqlite.OperationalError:
        pass

    # Migration: Add requires_input and created_at to custom_commands
    try:
        await db.execute("ALTER TABLE custom_commands ADD COLUMN requires_input INTEGER DEFAULT 1")
    except aiosqlite.OperationalError:
        pass
    try:
        await db.execute("ALTER TABLE custom_commands ADD COLUMN created_at TEXT DEFAULT (datetime('now'))")
    except aiosqlite.OperationalError:
        pass

    # Migration: Add faq_channel_id to guild_config
    try:
        await db.execute("ALTER TABLE guild_config ADD COLUMN faq_channel_id TEXT")
    except aiosqlite.OperationalError:
        pass

    await db.commit()


# --- Config helpers ---


async def get_config(key: str, default: str | None = None) -> str | None:
    """Get a config value from the database."""
    db = await get_db()
    cursor = await db.execute("SELECT value FROM config WHERE key = ?", (key,))
    row = await cursor.fetchone()
    return row["value"] if row else default


async def get_all_config() -> dict[str, str]:
    """Return all config key-value pairs."""
    db = await get_db()
    cursor = await db.execute("SELECT key, value FROM config")
    rows = await cursor.fetchall()
    return {row["key"]: row["value"] for row in rows}


async def set_config(key: str, value: str):
    """Set a config value in the database."""
    db = await get_db()
    await db.execute(
        "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )
    await db.commit()


async def set_config_bulk(data: dict[str, str]):
    """Set multiple config values at once."""
    db = await get_db()
    await db.executemany(
        "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        list(data.items()),
    )
    # Update config version to notify other processes
    import time
    version = str(int(time.time()))
    await db.execute(
        "INSERT INTO config (key, value) VALUES ('CONFIG_VERSION', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (version,),
    )
    await db.commit()


async def get_config_version() -> str:
    """Get the current configuration version."""
    return await get_config("CONFIG_VERSION", "0")


async def sync_env_to_db():
    """Seed the DB config table from current environment / .env values."""
    import config as cfg

    env_keys = {
        "DISCORD_TOKEN": cfg.DISCORD_TOKEN or "",
        "AI_PROVIDER": cfg.AI_PROVIDER,
        "GEMINI_API_KEY": cfg.GEMINI_API_KEY or "",
        "GEMINI_MODEL": cfg.GEMINI_MODEL,
        "GROQ_API_KEY": cfg.GROQ_API_KEY or "",
        "GROQ_MODEL": cfg.GROQ_MODEL,
        "OPENROUTER_API_KEY": cfg.OPENROUTER_API_KEY or "",
        "OPENROUTER_MODEL": cfg.OPENROUTER_MODEL,
        "ANTHROPIC_API_KEY": cfg.ANTHROPIC_API_KEY or "",
        "ANTHROPIC_MODEL": cfg.ANTHROPIC_MODEL,
        "OPENAI_API_KEY": cfg.OPENAI_API_KEY or "",
        "OPENAI_MODEL": cfg.OPENAI_MODEL,
        "BOT_PREFIX": cfg.BOT_PREFIX,
        "MAX_TOKENS": str(cfg.MAX_TOKENS),
        "SYSTEM_PROMPT": cfg.SYSTEM_PROMPT,
        "RATE_LIMIT_USER": str(cfg.RATE_LIMIT_USER),
        "RATE_LIMIT_GUILD": str(cfg.RATE_LIMIT_GUILD),
        "WELCOME_ENABLED": "true" if cfg.WELCOME_ENABLED else "false",
        "WELCOME_CHANNEL_ID": cfg.WELCOME_CHANNEL_ID,
        "WELCOME_MESSAGE": cfg.WELCOME_MESSAGE,
        "DIGEST_ENABLED": "true" if cfg.DIGEST_ENABLED else "false",
        "DIGEST_CHANNEL_ID": cfg.DIGEST_CHANNEL_ID,
        "DIGEST_TIME": cfg.DIGEST_TIME,
        "MODERATION_ENABLED": "true" if getattr(cfg, "MODERATION_ENABLED", False) else "false",
        "MOD_LOG_CHANNEL_ID": getattr(cfg, "MOD_LOG_CHANNEL_ID", ""),
        "MODERATION_SENSITIVITY": getattr(cfg, "MODERATION_SENSITIVITY", "medium"),
        "TRANSLATION_ENABLED": "true" if getattr(cfg, "TRANSLATION_ENABLED", False) else "false",
        "TRANSLATION_TARGET_LANG": getattr(cfg, "TRANSLATION_TARGET_LANG", "English"),
        "TRANSLATION_CHANNEL_IDS": getattr(cfg, "TRANSLATION_CHANNEL_IDS", ""),
        "JWT_SECRET": getattr(cfg, "JWT_SECRET", ""),
        "ADMIN_PASSWORD": getattr(cfg, "ADMIN_PASSWORD", ""),
    }
    
    # Critical keys that should always be synced from .env if they exist there
    CRITICAL_KEYS = {"ADMIN_PASSWORD", "JWT_SECRET", "DISCORD_TOKEN"}
    
    db = await get_db()
    existing_config = await get_all_config()
    
    for key, value in env_keys.items():
        # Update if it's a critical key OR if it doesn't exist in DB yet
        if key in CRITICAL_KEYS or key not in existing_config:
            if value: # Only sync non-empty values
                await db.execute(
                    "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    (key, value),
                )
    await db.commit()


async def sync_db_to_env():
    """Write DB config back to the .env file."""
    from dotenv import dotenv_values, set_key

    env_path = os.path.join(os.path.dirname(__file__), ".env")
    all_config = await get_all_config()

    for key, value in all_config.items():
        set_key(env_path, key, value)


# --- Conversation helpers ---


async def add_message(channel_id: str, role: str, content: str, provider: str | None = None, category: str | None = None):
    """Add a message to conversation history."""
    db = await get_db()
    await db.execute(
        "INSERT INTO conversations (channel_id, role, content, provider, category) VALUES (?, ?, ?, ?, ?)",
        (channel_id, role, content, provider, category),
    )
    await db.commit()


async def get_messages(channel_id: str, limit: int = 20) -> list[dict]:
    """Get recent messages for a channel."""
    db = await get_db()
    cursor = await db.execute(
        "SELECT role, content, provider, category, created_at FROM conversations WHERE channel_id = ? ORDER BY id DESC LIMIT ?",
        (channel_id, limit),
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in reversed(rows)]


async def clear_messages(channel_id: str):
    """Delete all messages for a channel."""
    db = await get_db()
    await db.execute("DELETE FROM conversations WHERE channel_id = ?", (channel_id,))
    await db.commit()


async def list_channels() -> list[dict]:
    """List all channels with message counts."""
    db = await get_db()
    cursor = await db.execute(
        """
        SELECT channel_id, COUNT(*) as message_count, MAX(created_at) as last_active
        FROM conversations
        GROUP BY channel_id
        ORDER BY last_active DESC
        """
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


# --- FAQ helpers ---


async def add_faq(guild_id: str, question: str, answer: str, keywords: str, created_by: str | None = None):
    """Add a new FAQ entry."""
    db = await get_db()
    await db.execute(
        "INSERT INTO faqs (guild_id, question, answer, match_keywords, created_by) VALUES (?, ?, ?, ?, ?)",
        (guild_id, question, answer, keywords, created_by),
    )
    await db.commit()


async def get_faqs(guild_id: str | None = None) -> list[dict]:
    """List all FAQs, optionally filtered by guild."""
    db = await get_db()
    if guild_id:
        cursor = await db.execute("SELECT * FROM faqs WHERE guild_id = ? ORDER BY id DESC", (guild_id,))
    else:
        cursor = await db.execute("SELECT * FROM faqs ORDER BY id DESC")
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


async def remove_faq(faq_id: int):
    """Delete a FAQ entry."""
    db = await get_db()
    await db.execute("DELETE FROM faqs WHERE id = ?", (faq_id,))
    await db.commit()


async def increment_faq_usage(faq_id: int):
    """Increment the usage counter for a FAQ."""
    db = await get_db()
    await db.execute("UPDATE faqs SET times_used = times_used + 1 WHERE id = ?", (faq_id,))
    await db.commit()


# --- Permission helpers ---


async def add_command_permission(command_name: str, guild_id: str, role_id: str):
    """Restrict a command to a specific role."""
    db = await get_db()
    await db.execute(
        "INSERT OR IGNORE INTO command_permissions (command_name, guild_id, role_id) VALUES (?, ?, ?)",
        (command_name, guild_id, role_id),
    )
    await db.commit()


async def remove_command_permission(command_name: str, guild_id: str, role_id: str):
    """Remove a role restriction from a command."""
    db = await get_db()
    await db.execute(
        "DELETE FROM command_permissions WHERE command_name = ? AND guild_id = ? AND role_id = ?",
        (command_name, guild_id, role_id),
    )
    await db.commit()


async def get_command_permissions(command_name: str, guild_id: str) -> list[str]:
    """Get all allowed role IDs for a specific command."""
    db = await get_db()
    cursor = await db.execute(
        "SELECT role_id FROM command_permissions WHERE command_name = ? AND guild_id = ?",
        (command_name, guild_id),
    )
    rows = await cursor.fetchall()
    return [row["role_id"] for row in rows]


async def get_guild_permissions(guild_id: str) -> list[dict]:
    """Get all command permissions for a guild."""
    db = await get_db()
    cursor = await db.execute(
        "SELECT * FROM command_permissions WHERE guild_id = ?",
        (guild_id,),
    )
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


# --- Moderation helpers ---


async def add_moderation_event(guild_id: str, channel_id: str, user_id: str, user_name: str, message_content: str, reason: str, severity: str):
    """Log a moderation event."""
    db = await get_db()
    await db.execute(
        "INSERT INTO moderation_events (guild_id, channel_id, user_id, user_name, message_content, reason, severity) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (guild_id, channel_id, user_id, user_name, message_content, reason, severity),
    )
    await db.commit()


async def get_moderation_events(guild_id: str | None = None, limit: int = 50) -> list[dict]:
    """Get recent moderation events."""
    db = await get_db()
    if guild_id:
        cursor = await db.execute("SELECT * FROM moderation_events WHERE guild_id = ? ORDER BY id DESC LIMIT ?", (guild_id, limit))
    else:
        cursor = await db.execute("SELECT * FROM moderation_events ORDER BY id DESC LIMIT ?", (limit,))
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


# --- Channel Prompt helpers ---


async def set_channel_prompt(channel_id: str, guild_id: str, system_prompt: str):
    """Set a custom system prompt for a channel."""
    db = await get_db()
    await db.execute(
        "INSERT INTO channel_prompts (channel_id, guild_id, system_prompt, updated_at) VALUES (?, ?, ?, datetime('now')) "
        "ON CONFLICT(channel_id) DO UPDATE SET system_prompt = excluded.system_prompt, updated_at = datetime('now')",
        (channel_id, guild_id, system_prompt),
    )
    await db.commit()


async def get_channel_prompt_with_time(channel_id: str) -> tuple[str | None, str | None]:
    """Get the custom system prompt and its last update time for a channel."""
    db = await get_db()
    cursor = await db.execute("SELECT system_prompt, updated_at FROM channel_prompts WHERE channel_id = ?", (channel_id,))
    row = await cursor.fetchone()
    return (row["system_prompt"], row["updated_at"]) if row else (None, None)


async def get_channel_prompt(channel_id: str) -> str | None:
    """Get the custom system prompt for a channel (Legacy wrapper)."""
    prompt, _ = await get_channel_prompt_with_time(channel_id)
    return prompt


async def delete_channel_prompt(channel_id: str):
    """Delete a custom system prompt for a channel."""
    db = await get_db()
    await db.execute("DELETE FROM channel_prompts WHERE channel_id = ?", (channel_id,))
    await db.commit()


async def list_channel_prompts() -> list[dict]:
    """List all custom channel prompts."""
    db = await get_db()
    cursor = await db.execute("SELECT * FROM channel_prompts")
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


# --- Channel Provider helpers ---


async def set_channel_provider(channel_id: str, guild_id: str, provider_name: str):
    """Set a custom AI provider for a channel."""
    db = await get_db()
    await db.execute(
        "INSERT INTO channel_providers (channel_id, guild_id, provider_name) VALUES (?, ?, ?) "
        "ON CONFLICT(channel_id) DO UPDATE SET provider_name = excluded.provider_name",
        (channel_id, guild_id, provider_name),
    )
    await db.commit()


async def get_channel_provider(channel_id: str) -> str | None:
    """Get the custom AI provider for a channel."""
    db = await get_db()
    cursor = await db.execute("SELECT provider_name FROM channel_providers WHERE channel_id = ?", (channel_id,))
    row = await cursor.fetchone()
    return row["provider_name"] if row else None


async def delete_channel_provider(channel_id: str):
    """Delete a custom AI provider for a channel."""
    db = await get_db()
    await db.execute("DELETE FROM channel_providers WHERE channel_id = ?", (channel_id,))
    await db.commit()


async def list_channel_providers() -> list[dict]:
    """List all custom channel providers."""
    db = await get_db()
    cursor = await db.execute("SELECT * FROM channel_providers")
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


# --- Guild Config helpers ---


async def get_guild_config(guild_id: str) -> dict | None:
    """Get the configuration for a specific guild."""
    db = await get_db()
    cursor = await db.execute("SELECT * FROM guild_config WHERE guild_id = ?", (guild_id,))
    row = await cursor.fetchone()
    if not row:
        return None
    
    data = dict(row)
    # Convert integer booleans to actual booleans
    data["welcome_enabled"] = bool(data["welcome_enabled"])
    data["digest_enabled"] = bool(data["digest_enabled"])
    data["moderation_enabled"] = bool(data["moderation_enabled"])
    return data


async def set_guild_config(guild_id: str, data: dict):
    """Update or create guild configuration."""
    db = await get_db()
    
    # Extract values with defaults for updates
    welcome_enabled = int(data.get("welcome_enabled", False))
    welcome_channel_id = data.get("welcome_channel_id")
    welcome_message = data.get("welcome_message")
    digest_enabled = int(data.get("digest_enabled", False))
    digest_channel_id = data.get("digest_channel_id")
    digest_time = data.get("digest_time", "09:00")
    moderation_enabled = int(data.get("moderation_enabled", False))
    mod_log_channel_id = data.get("mod_log_channel_id")
    moderation_sensitivity = data.get("moderation_sensitivity", "medium")
    faq_channel_id = data.get("faq_channel_id")

    await db.execute(
        """
        INSERT INTO guild_config (
            guild_id, welcome_enabled, welcome_channel_id, welcome_message,
            digest_enabled, digest_channel_id, digest_time,
            moderation_enabled, mod_log_channel_id, moderation_sensitivity,
            faq_channel_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET
            welcome_enabled = excluded.welcome_enabled,
            welcome_channel_id = excluded.welcome_channel_id,
            welcome_message = excluded.welcome_message,
            digest_enabled = excluded.digest_enabled,
            digest_channel_id = excluded.digest_channel_id,
            digest_time = excluded.digest_time,
            moderation_enabled = excluded.moderation_enabled,
            mod_log_channel_id = excluded.mod_log_channel_id,
            moderation_sensitivity = excluded.moderation_sensitivity,
            faq_channel_id = excluded.faq_channel_id
        """,
        (
            guild_id, welcome_enabled, welcome_channel_id, welcome_message,
            digest_enabled, digest_channel_id, digest_time,
            moderation_enabled, mod_log_channel_id, moderation_sensitivity,
            faq_channel_id
        )
    )
    await db.commit()


async def list_guild_configs() -> list[dict]:
    """List all guild configurations."""
    db = await get_db()
    cursor = await db.execute("SELECT * FROM guild_config")
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


# --- Plugin helpers ---


async def set_plugin_status(name: str, enabled: bool):
    """Enable or disable a plugin."""
    db = await get_db()
    await db.execute(
        "INSERT INTO plugins (name, enabled) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET enabled = excluded.enabled",
        (name, int(enabled)),
    )
    await db.commit()


async def get_enabled_plugins() -> list[str]:
    """Get list of enabled plugin names."""
    db = await get_db()
    cursor = await db.execute("SELECT name FROM plugins WHERE enabled = 1")
    rows = await cursor.fetchall()
    return [row["name"] for row in rows]


async def list_plugin_states() -> dict[str, bool]:
    """Get a mapping of plugin names to their enabled status."""
    db = await get_db()
    cursor = await db.execute("SELECT name, enabled FROM plugins")
    rows = await cursor.fetchall()
    return {row["name"]: bool(row["enabled"]) for row in rows}


# --- Wizard helpers ---


async def get_wizard_state() -> dict:
    """Get the wizard state."""
    db = await get_db()
    cursor = await db.execute("SELECT completed, current_step, data FROM wizard_state WHERE id = 1")
    row = await cursor.fetchone()
    return {
        "completed": bool(row["completed"]),
        "current_step": row["current_step"],
        "data": json.loads(row["data"]),
    }


async def set_wizard_state(completed: bool | None = None, current_step: int | None = None, data: dict | None = None):
    """Update wizard state fields."""
    db = await get_db()
    updates = []
    params = []
    if completed is not None:
        updates.append("completed = ?")
        params.append(int(completed))
    if current_step is not None:
        updates.append("current_step = ?")
        params.append(current_step)
    if data is not None:
        updates.append("data = ?")
        params.append(json.dumps(data))
    if updates:
        await db.execute(f"UPDATE wizard_state SET {', '.join(updates)} WHERE id = 1", params)
        await db.commit()


# --- Session helpers ---


async def create_session(token: str, user_id: str, expires_at: str):
    """Store a session token."""
    db = await get_db()
    await db.execute(
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
        (token, user_id, expires_at),
    )
    await db.commit()


async def validate_session(token: str) -> dict | None:
    """Validate a session token, return session data or None."""
    db = await get_db()
    cursor = await db.execute(
        "SELECT user_id, expires_at FROM sessions WHERE token = ? AND expires_at > datetime('now')",
        (token,),
    )
    row = await cursor.fetchone()
    return dict(row) if row else None


async def delete_session(token: str):
    """Delete a session."""
    db = await get_db()
    try:
        await db.execute("DELETE FROM sessions WHERE token = ?", (token,))
        await db.commit()
    except Exception:
        pass


async def close_db():
    """Close the database connection for the current loop."""
    try:
        loop = asyncio.get_running_loop()
        if loop in _db_connections:
            await _db_connections[loop].close()
            del _db_connections[loop]
    except RuntimeError:
        pass


# --- Analytics helpers ---


async def add_analytics_event(
    event_type: str,
    guild_id: str | None = None,
    channel_id: str | None = None,
    user_id: str | None = None,
    provider: str | None = None,
    tokens_used: int | None = None,
    input_tokens: int | None = None,
    output_tokens: int | None = None,
    estimated_cost: float | None = None,
    latency_ms: int | None = None,
):
    """Log an analytics event."""
    db = await get_db()
    await db.execute(
        """
        INSERT INTO analytics (
            event_type, guild_id, channel_id, user_id, provider, 
            tokens_used, input_tokens, output_tokens, estimated_cost, latency_ms
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event_type, guild_id, channel_id, user_id, provider, 
            tokens_used, input_tokens, output_tokens, estimated_cost, latency_ms
        ),
    )
    await db.commit()


async def get_analytics_summary(guild_id: str | None = None) -> dict:
    """Get summarized analytics for the dashboard."""
    db = await get_db()
    
    where_clause = "WHERE event_type IN ('mention', 'command')"
    params = []
    if guild_id:
        where_clause += " AND guild_id = ?"
        params.append(guild_id)

    # Messages per day
    cursor = await db.execute(
        f"""
        SELECT date(created_at) as day, COUNT(*) as count
        FROM analytics
        {where_clause}
        GROUP BY day
        ORDER BY day DESC
        LIMIT 30
        """,
        params
    )
    messages_per_day = [dict(row) for row in await cursor.fetchall()]
    
    # Provider usage
    where_prov = "WHERE provider IS NOT NULL"
    params_prov = []
    if guild_id:
        where_prov += " AND guild_id = ?"
        params_prov.append(guild_id)

    cursor = await db.execute(
        f"""
        SELECT provider, COUNT(*) as count
        FROM analytics
        {where_prov}
        GROUP BY provider
        """,
        params_prov
    )
    provider_usage = [dict(row) for row in await cursor.fetchall()]
    
    # Top channels
    where_chan = "WHERE channel_id IS NOT NULL"
    params_chan = []
    if guild_id:
        where_chan += " AND guild_id = ?"
        params_chan.append(guild_id)

    cursor = await db.execute(
        f"""
        SELECT channel_id, COUNT(*) as count
        FROM analytics
        {where_chan}
        GROUP BY channel_id
        ORDER BY count DESC
        LIMIT 10
        """,
        params_chan
    )
    top_channels = [dict(row) for row in await cursor.fetchall()]
    
    # Average latency
    where_lat = "WHERE latency_ms IS NOT NULL"
    params_lat = []
    if guild_id:
        where_lat += " AND guild_id = ?"
        params_lat.append(guild_id)

    cursor = await db.execute(
        f"""
        SELECT date(created_at) as day, AVG(latency_ms) as avg_latency
        FROM analytics
        {where_lat}
        GROUP BY day
        ORDER BY day DESC
        LIMIT 30
        """,
        params_lat
    )
    avg_latency = [dict(row) for row in await cursor.fetchall()]
    
    return {
        "messages_per_day": list(reversed(messages_per_day)),
        "provider_usage": provider_usage,
        "top_channels": top_channels,
        "avg_latency": list(reversed(avg_latency)),
    }


async def get_analytics_history(limit: int = 100, guild_id: str | None = None) -> list[dict]:
    """Get detailed analytics event history."""
    db = await get_db()
    
    query = "SELECT * FROM analytics"
    params = []
    if guild_id:
        query += " WHERE guild_id = ?"
        params.append(guild_id)
    
    query += " ORDER BY id DESC LIMIT ?"
    params.append(limit)

    cursor = await db.execute(query, params)
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


async def get_cost_summary() -> dict:
    """Get summarized cost analytics for the dashboard."""
    db = await get_db()
    
    # Total cost
    cursor = await db.execute("SELECT SUM(estimated_cost) as total FROM analytics")
    row = await cursor.fetchone()
    total_cost = row["total"] or 0.0
    
    # Cost per provider
    cursor = await db.execute(
        """
        SELECT provider, SUM(estimated_cost) as cost
        FROM analytics
        WHERE estimated_cost IS NOT NULL
        GROUP BY provider
        """
    )
    provider_costs = [dict(row) for row in await cursor.fetchall()]
    
    # Cost per day (last 30 days)
    cursor = await db.execute(
        """
        SELECT date(created_at) as day, SUM(estimated_cost) as cost
        FROM analytics
        WHERE estimated_cost IS NOT NULL
        GROUP BY day
        ORDER BY day DESC
        LIMIT 30
        """
    )
    daily_costs = [dict(row) for row in await cursor.fetchall()]
    
    return {
        "total_cost": total_cost,
        "provider_costs": provider_costs,
        "daily_costs": list(reversed(daily_costs)),
    }


# --- Custom Command helpers ---


async def get_custom_commands() -> list[dict]:
    """List all custom AI commands."""
    db = await get_db()
    cursor = await db.execute("SELECT * FROM custom_commands ORDER BY name ASC")
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


async def add_custom_command(name: str, description: str, prompt: str, requires_input: bool = True):
    """Add or update a custom AI command."""
    db = await get_db()
    await db.execute(
        "INSERT INTO custom_commands (name, description, prompt, requires_input) VALUES (?, ?, ?, ?) "
        "ON CONFLICT(name) DO UPDATE SET description = excluded.description, prompt = excluded.prompt, requires_input = excluded.requires_input",
        (name, description, prompt, int(requires_input)),
    )
    await db.commit()


async def delete_custom_command(name: str):
    """Delete a custom AI command."""
    db = await get_db()
    await db.execute("DELETE FROM custom_commands WHERE name = ?", (name,))
    await db.commit()
