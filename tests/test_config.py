import pytest
import config
import db

@pytest.mark.asyncio
async def test_reload_from_db():
    # Set values in DB
    await db.set_config_bulk({
        "BOT_PREFIX": ">>",
        "MAX_TOKENS": "512"
    })
    
    # Reload
    all_cfg = await db.get_all_config()
    config.reload_from_db(all_cfg)
    
    assert config.BOT_PREFIX == ">>"
    assert config.MAX_TOKENS == 512
