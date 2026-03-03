import pytest
import providers
import config

def test_fallback_order():
    """Test that primary provider is always first in fallback order."""
    config.AI_PROVIDER = "openai"
    order = providers._build_fallback_order()
    assert order[0] == "openai"
    
    config.AI_PROVIDER = "groq"
    order = providers._build_fallback_order()
    assert order[0] == "groq"

@pytest.mark.asyncio
async def test_get_available_providers():
    # Since we use mocks or empty keys in tests, check logic
    # Real testing requires mocking AsyncOpenAI
    available = providers.get_available_providers()
    assert isinstance(available, list)
