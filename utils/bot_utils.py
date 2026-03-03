from __future__ import annotations
import config
import providers
import db as database
from utils.rate_limiter import limiter

MAX_HISTORY = 20


async def get_history(channel_id: int) -> list[dict]:
    """Get conversation history for a channel from the database."""
    messages = await database.get_messages(str(channel_id), limit=MAX_HISTORY)
    return [{"role": m["role"], "content": m["content"]} for m in messages]


async def ask_ai(
    channel_id: int, 
    user_name: str, 
    message: str, 
    system_prompt: str | None = None,
    category: str | None = None,
    guild_id: str | None = None,
    user_id: str | None = None
) -> tuple[str, str]:
    """Send a message to AI and return (response, provider_name)."""
    # 1. Check Rate Limits
    if user_id:
        is_limited, retry_after = limiter.check_user(user_id)
        if is_limited:
            return f"⚠️ You are sending requests too fast! Please try again in {retry_after}s.", "none"
    
    if guild_id:
        is_limited, retry_after = limiter.check_guild(guild_id)
        if is_limited:
            return f"⚠️ This server has reached its AI rate limit. Please try again in {retry_after}s.", "none"

    # Check for channel-specific prompt and provider
    channel_prompt = await database.get_channel_prompt(str(channel_id))
    forced_provider = await database.get_channel_provider(str(channel_id))
    
    # Store user message in DB
    await database.add_message(str(channel_id), "user", f"{user_name}: {message}", category=category)

    history = await get_history(channel_id)
    
    # Priority: 
    # 1. Parameter system_prompt (from specialized cogs like code review)
    # 2. Database channel_prompt
    # 3. Global config system prompt
    prompt = system_prompt or channel_prompt or config.SYSTEM_PROMPT

    try:
        if forced_provider:
            # If a provider is forced for this channel, try ONLY that one (no fallback)
            from providers import _clients
            client = _clients.get(forced_provider)
            if client:
                import time
                start = time.time()
                prov_cfg = config.PROVIDERS[forced_provider]
                model = prov_cfg["model"]

                response_obj = await client.chat.completions.create(
                    model=model,
                    max_tokens=config.MAX_TOKENS,
                    messages=[
                        {"role": "system", "content": prompt},
                        *history,
                    ],
                )
                response = response_obj.choices[0].message.content
                provider_name = forced_provider
                latency = int((time.time() - start) * 1000)
                
                usage = response_obj.usage
                input_tokens = usage.prompt_tokens if hasattr(usage, "prompt_tokens") else 0
                output_tokens = usage.completion_tokens if hasattr(usage, "completion_tokens") else 0
                total_tokens = usage.total_tokens if hasattr(usage, "total_tokens") else 0
                from providers import _calculate_cost
                cost = _calculate_cost(forced_provider, input_tokens, output_tokens)
                
                # Log analytics event manually for forced provider
                await database.add_analytics_event(
                    event_type="mention",
                    guild_id=guild_id,
                    channel_id=str(channel_id),
                    user_id=user_id,
                    provider=forced_provider,
                    tokens_used=total_tokens,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    estimated_cost=cost,
                    latency_ms=latency
                )
            else:
                # Fallback to normal chat if forced client not found
                response, provider_name = await providers.chat(
                    history, prompt, guild_id=guild_id, channel_id=str(channel_id), user_id=user_id
                )
        else:
            response, provider_name = await providers.chat(
                history, prompt, guild_id=guild_id, channel_id=str(channel_id), user_id=user_id
            )
            
        # Store assistant response in DB
        await database.add_message(str(channel_id), "assistant", response, provider=provider_name, category=category)
        return response, provider_name
    except RuntimeError as e:
        return f"Sorry, all AI providers failed:\n{e}", "none"
    except Exception as e:
        return f"An error occurred: {e}", "none"
