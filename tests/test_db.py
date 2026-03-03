import pytest
import db

@pytest.mark.asyncio
async def test_init_db():
    """Test that all tables are created correctly."""
    conn = await db.get_db()
    # Check if config table exists
    cursor = await conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='config'")
    row = await cursor.fetchone()
    assert row is not None
    assert row[0] == "config"

@pytest.mark.asyncio
async def test_config_operations():
    """Test setting and getting config values."""
    await db.set_config("test_key", "test_value")
    val = await db.get_config("test_key")
    assert val == "test_value"
    
    # Bulk update
    await db.set_config_bulk({"key1": "val1", "key2": "val2"})
    all_cfg = await db.get_all_config()
    assert all_cfg["key1"] == "val1"
    assert all_cfg["key2"] == "val2"

@pytest.mark.asyncio
async def test_guild_config():
    """Test guild-specific configuration."""
    guild_id = "12345"
    data = {
        "welcome_enabled": True,
        "welcome_channel_id": "channel_1",
        "welcome_message": "Hello!"
    }
    await db.set_guild_config(guild_id, data)
    
    cfg = await db.get_guild_config(guild_id)
    assert cfg is not None
    assert cfg["welcome_enabled"] is True
    assert cfg["welcome_channel_id"] == "channel_1"
    assert cfg["welcome_message"] == "Hello!"
