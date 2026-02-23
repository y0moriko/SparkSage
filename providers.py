from __future__ import annotations

import time
from openai import OpenAI, AsyncOpenAI
import config
import db


def _create_client(provider_name: str) -> AsyncOpenAI | None:
    """Create an OpenAI-compatible client for the given provider."""
    provider = config.PROVIDERS.get(provider_name)
    if not provider or not provider["api_key"]:
        return None

    extra_headers = {}
    if provider_name == "anthropic":
        extra_headers["anthropic-version"] = "2023-06-01"

    return AsyncOpenAI(
        base_url=provider["base_url"],
        api_key=provider["api_key"],
        default_headers=extra_headers or None,
    )


def _build_fallback_order() -> list[str]:
    """Build the provider fallback order: primary first, then free providers."""
    primary = config.AI_PROVIDER
    order = [primary]
    for name in config.FREE_FALLBACK_CHAIN:
        if name not in order:
            order.append(name)
    return order


def _build_clients() -> dict[str, OpenAI]:
    """Build clients for all configured providers."""
    clients = {}
    for name in set([config.AI_PROVIDER] + config.FREE_FALLBACK_CHAIN + list(config.PROVIDERS.keys())):
        client = _create_client(name)
        if client:
            clients[name] = client
    return clients


# Pre-build clients for all configured providers
_clients: dict[str, AsyncOpenAI] = _build_clients()
FALLBACK_ORDER = _build_fallback_order()


def reload_clients():
    """Rebuild all clients and fallback order from current config."""
    global _clients, FALLBACK_ORDER
    _clients = _build_clients()
    FALLBACK_ORDER = _build_fallback_order()


def get_available_providers() -> list[str]:
    """Return list of provider names that have valid API keys configured."""
    return [name for name in FALLBACK_ORDER if name in _clients]


def _calculate_cost(provider_name: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate estimated cost in USD based on token counts."""
    pricing = config.PROVIDER_PRICING.get(provider_name)
    if not pricing:
        return 0.0
    
    in_cost = (input_tokens / 1_000_000) * pricing["input"]
    out_cost = (output_tokens / 1_000_000) * pricing["output"]
    return round(in_cost + out_cost, 6)


async def test_provider(name: str, api_key: str | None = None) -> dict:
    """Test a provider with a minimal API call. Returns {success, latency_ms, error}."""
    provider = config.PROVIDERS.get(name)
    if not provider:
        return {"success": False, "latency_ms": 0, "error": f"Unknown provider: {name}"}

    # Use the provided API key (for wizard) OR the shared client
    if api_key:
        client = AsyncOpenAI(
            base_url=provider["base_url"],
            api_key=api_key,
        )
    else:
        client = _clients.get(name)
        if not client:
            # Try creating a fresh client in case config was just updated
            client = _create_client(name)
            if not client:
                return {"success": False, "latency_ms": 0, "error": "No API key configured"}

    start = time.time()
    try:
        response = await client.chat.completions.create(
            model=provider["model"],
            max_tokens=10,
            messages=[{"role": "user", "content": "Hi"}],
        )
        latency = int((time.time() - start) * 1000)
        
        # Log analytics event
        usage = response.usage
        input_tokens = usage.prompt_tokens if hasattr(usage, "prompt_tokens") else 0
        output_tokens = usage.completion_tokens if hasattr(usage, "completion_tokens") else 0
        total_tokens = usage.total_tokens if hasattr(usage, "total_tokens") else 0
        cost = _calculate_cost(name, input_tokens, output_tokens)

        await db.add_analytics_event(
            event_type="test_provider",
            provider=name,
            latency_ms=latency,
            tokens_used=total_tokens,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost=cost
        )
        
        return {"success": True, "latency_ms": latency, "message": "Connection successful", "error": None}
    except Exception as e:
        latency = int((time.time() - start) * 1000)
        return {"success": False, "latency_ms": latency, "message": str(e), "error": str(e)}


async def chat(
    messages: list[dict], 
    system_prompt: str,
    guild_id: str | None = None,
    channel_id: str | None = None,
    user_id: str | None = None
) -> tuple[str, str]:
    """Send messages to AI and return (response_text, provider_name).

    Tries the primary provider first, then falls back through free providers.
    Raises RuntimeError if all providers fail.
    """
    errors = []

    for provider_name in FALLBACK_ORDER:
        client = _clients.get(provider_name)
        if not client:
            continue

        provider = config.PROVIDERS[provider_name]
        model = provider["model"]

        start = time.time()
        try:
            response = await client.chat.completions.create(
                model=model,
                max_tokens=config.MAX_TOKENS,
                messages=[
                    {"role": "system", "content": system_prompt},
                    *messages,
                ],
            )
            text = response.choices[0].message.content
            latency = int((time.time() - start) * 1000)
            
            usage = response.usage
            input_tokens = usage.prompt_tokens if hasattr(usage, "prompt_tokens") else 0
            output_tokens = usage.completion_tokens if hasattr(usage, "completion_tokens") else 0
            total_tokens = usage.total_tokens if hasattr(usage, "total_tokens") else 0
            cost = _calculate_cost(provider_name, input_tokens, output_tokens)

            # Log analytics event
            await db.add_analytics_event(
                event_type="mention",
                guild_id=guild_id,
                channel_id=channel_id,
                user_id=user_id,
                provider=provider_name,
                tokens_used=total_tokens,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                estimated_cost=cost,
                latency_ms=latency
            )

            return text, provider_name

        except Exception as e:
            errors.append(f"{provider['name']}: {e}")
            continue

    error_details = "\n".join(errors)
    raise RuntimeError(f"All providers failed:\n{error_details}")
